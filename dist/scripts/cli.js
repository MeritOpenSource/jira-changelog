#!/usr/bin/env node

/**
 * The jira-changelog CLI
 */
"use strict";

require("core-js/stable");

require("regenerator-runtime/runtime");

require("source-map-support/register");

var _commander = _interopRequireDefault(require("commander"));

var _path = _interopRequireDefault(require("path"));

var _Slack = _interopRequireDefault(require("./Slack"));

var _htmlEntities = require("html-entities");

var _template = require("./template");

var _Config = require("./Config");

var _SourceControl = _interopRequireDefault(require("./SourceControl"));

var _Jira = _interopRequireDefault(require("./Jira"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

runProgram();
/**
 * Parse command line arguments
 */

function commandLineArgs() {
  const pkg = require('../../package.json');

  _commander.default.version(pkg.version).option('-c, --config <filepath>', 'Path to the config file.').option('-r, --range <from>...<to>', 'git commit range for changelog', parseRange).option('-d, --date <date>[...date]', 'Only include commits after this date', parseRange).option('-s, --slack', 'Automatically post changelog to slack (if configured)').option('--release [release]', 'Assign a release version to these stories').option('-t, --ticket <ticketId>', 'Add the changelog to the description of the specified ticket').parse(process.argv);
}
/**
 * Run the main program
 */


async function runProgram() {
  try {
    commandLineArgs(); // Determine the git workspace path

    let gitPath = process.cwd();

    if (_commander.default.args.length) {
      gitPath = _commander.default.args[0];
    }

    gitPath = _path.default.resolve(gitPath);
    const config = (0, _Config.readConfigFile)(gitPath);
    const jira = new _Jira.default(config);
    const source = new _SourceControl.default(config); // Release flag used, but no name passed

    if (_commander.default.release === true) {
      if (typeof config.jira.generateReleaseVersionName !== 'function') {
        console.log("You need to define the jira.generateReleaseVersionName function in your config, if you're not going to pass the release version name in the command.");
        return;
      }

      _commander.default.release = await config.jira.generateReleaseVersionName();
    } // Get logs


    const range = getRangeObject(config);
    const commitLogs = await source.getCommitLogs(gitPath, range);
    const changelog = await jira.generate(commitLogs, _commander.default.release); // Render template

    const tmplData = await (0, _template.generateTemplateData)(config, changelog, jira.releaseVersions);
    const changelogMessage = (0, _template.renderTemplate)(config, tmplData); // Output to console

    const entitles = new _htmlEntities.AllHtmlEntities();
    console.log(entitles.decode(changelogMessage)); // Post to slack

    if (_commander.default.slack) {
      await postToSlack(config, tmplData, changelogMessage);
    } // Update release ticket if one is provided


    if (_commander.default.ticket) {
      await jira.updateReleaseTicket(_commander.default.ticket, changelogMessage);
    }
  } catch (e) {
    console.error(e.stack || e);
    process.exit(1);
  }
}
/**
 * Post the changelog to slack
 *
 * @param {Object} config - The configuration object
 * @param {Object} data - The changelog data object.
 * @param {String} changelogMessage - The changelog message
 */


async function postToSlack(config, data, changelogMessage) {
  const slack = new _Slack.default(config);

  if (!slack.isEnabled() || !config.slack.channel) {
    throw new Error('Error: Slack is not configured.');
    return;
  }

  console.log(`\nPosting changelog message to slack channel: ${config.slack.channel}...`);

  try {
    // Transform for slack
    if (typeof config.transformForSlack == 'function') {
      changelogMessage = await Promise.resolve(config.transformForSlack(changelogMessage, data));
    } // Post to slack


    await slack.postMessage(changelogMessage, config.slack.channel);
    console.log('Sent');
  } catch (err) {
    throw new Error(err);
  }
}
/**
 * Convert a range string formatted as "a...b" into an array.
 *
 * @param {String} rangeStr - The range string.
 * @return {Array}
 */


function parseRange(rangeStr) {
  return rangeStr.split(/\.{3,3}/);
}
/**
 * Construct the range object from the CLI arguments and config
 *
 * @param {Object} config - The config object provided by Config.getConfigForPath
 * @return {Object}
 */


function getRangeObject(config) {
  const range = {};
  const defaultRange = config.sourceControl && config.sourceControl.defaultRange ? config.sourceControl.defaultRange : {};

  if (_commander.default.range && _commander.default.range.length) {
    range.from = _commander.default.range[0];
    range.to = _commander.default.range[1];
  }

  if (_commander.default.dateRange && _commander.default.dateRange.length) {
    range.after = _commander.default.dateRange[0];

    if (_commander.default.dateRange.length > 1) {
      range.before = _commander.default.dateRange[1];
    }
  } // Use default range


  if (!Object.keys(range).length && Object.keys(defaultRange).length) {
    Object.assign(range, defaultRange);
  }

  if (!Object.keys(range).length) {
    throw new Error('No range defined for the changelog.');
  }

  return range;
}
//# sourceMappingURL=cli.js.map