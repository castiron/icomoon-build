var fs = require("fs");
var console = require("console")
var util = require("util")
var path = require("path");
var childProcess = require("child_process");
var AdmZip = require('adm-zip');
var phantomjs = require("phantomjs");
var binPath = phantomjs.path;

function buildScssSheet(selection) {
    var prefix = selection.preferences.fontPref.prefix;
    var contentDeclarations = "";
    var mainMixin = "";
    selection.icons.forEach(function(iconEntry) {
        var props = iconEntry.properties;
        contentDeclarations += util.format('$%s%s-content: "\\%s";\n', prefix, props.name, props.code.toString(16));
        mainMixin += util.format(".%s%s:before { content: $%s%s-content; }\n", prefix, props.name, prefix, props.name);
    });
    var output = "";
    output += "// Script-generated file, do not modify by hand\n\n";
    output += contentDeclarations;
    output += "\n";
    output += util.format("@mixin %sclasses {\n", prefix);
    output += "    " + mainMixin.replace(/\n(?=.+?)/g, "\n    ");
    output += "}\n";
    return output;
}

function buildProject(projectFilePath, cb) {
    var childArgs = [
        path.join(__dirname, "icomoon.phantom.js"), projectFilePath
    ];
    childProcess.execFile(binPath, childArgs, function(err, stdout, stderr) {
        if (err) {
            cb(err);
            return;
        }
        try {
            var buf = new Buffer(stdout, "base64");
            var zip = new AdmZip(buf);
            var zipEntries = zip.getEntries(); // an array of ZipEntry records

            var result = {
                fonts: {}
            };
            zipEntries.forEach(function(zipEntry) {
                if (/.+\/.*\.(ttf|woff|eot|svg)$/.test(zipEntry.entryName)) {
                    result.fonts[zipEntry.name] = {
                        path: zipEntry.entryName,
                        data: zip.readFile(zipEntry),
                    };
                } else if (/^[^\/]+\.css$/.test(zipEntry.entryName)) {
                    result.stylesheet = zip.readAsText(zipEntry);
                } else if ("selection.json" === zipEntry.entryName) {
                    result.selection = JSON.parse(zip.readAsText(zipEntry));
                }
            });
            result.scss = buildScssSheet(result.selection);
        } catch (e) {
            cb(e);
            return;
        }
        cb(null, result);
    });
}

module.exports = {
    buildProject: buildProject,
    buildScssSheet: buildScssSheet,
};