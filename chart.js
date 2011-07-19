
var jsdom = require('jsdom'),
		fs = require('fs'),
		spawn	= require('child_process').spawn;


function createHighchartsWindow(callback) {
	var window 	= jsdom.jsdom().createWindow(),
	script	= window.document.createElement('script');

	// Convince Highcharts that our window supports SVG's
	window.SVGAngle = true;

	// jsdom doesn't yet support createElementNS, so just fake it up
	window.document.createElementNS = function(ns, tagName) {
		var elem = window.document.createElement(tagName);	
		elem.getBBox = function() {
			return {
				x: elem.offsetLeft,
				y: elem.offsetTop,
				width: elem.offsetWidth,
				height: elem.offsetHeight
			};
		};
		return elem;
	};

	// Load scripts
	jsdom.jQueryify(window, 'http://code.jquery.com/jquery-1.4.2.min.js', function(w,jq) {
		var filename = 'file:///' + __dirname + '/highcharts.src.js';
//console.log(filename);
		script.src = filename;
		script.onload = function() {
			callback(window);
		}
		window.document.body.appendChild(script);
	});
}


function serverifyOptions(options) {
	options.chart.renderTo = 'container';
	options.chart.renderer = 'SVG';
	options.chart.animation = false;
	options.series.forEach(function(series) {
		series.animation = false;
	});
}


module.exports = {

	exportHighchartsToPng: function(options, pngFilename, callback) {

		createHighchartsWindow(function(window) {
			try {
				var $	= window.jQuery,
					Highcharts 	= window.Highcharts,
					document	= window.document,
					$container	= $('<div id="container" />'),
					chart, svg, convert, buffer;

				$container.appendTo(document.body);

				serverifyOptions(options);

				try {
					chart = new Highcharts.Chart(options);
				} catch (e) {
					callback(e, null);
					return;
				}

				svg = $container.children().html();

				var svgFilename = __dirname + '/__tmp.svg';
				fs.unlink(svgFilename, function(){
					fs.writeFile(svgFilename, svg, function() {
						console.log('Generated SVG chart to ['+svgFilename+']');

						// now convert svg to chart image
						//convert	= spawn('convert', ['svg:'+svgFilename, 'png:'+pngFilename]);
						convert = spawn('/usr/bin/rsvg-convert', [svgFilename, '-f', 'png', '-o', pngFilename]);

convert.stdout.on('data', function (data) {
  console.log('stdout: ' + data);
});

convert.stderr.on('data', function (data) {
  console.log('stderr: ' + data);
});


						// When we're done, we're done
						convert.on('exit', function(code) {
	    				fs.unlink(svgFilename);
							if (code == 0) {
								console.log('Converted chart to ['+pngFilename+']. Code='+code);
								callback(null, buffer);
							}
							else {
								console.log('FAILED converting chart to PNG: exit code='+code);
								callback(code, null);
							}
						});
					});
				});

			} catch (err) {
				callback(err, null);
			}
		});
	},


	exportSvgToPng: function(svg, pngFilename, callback) {

			var svgFilename = __dirname + '/__tmp.svg';
			fs.unlink(svgFilename, function() {
				fs.writeFile(svgFilename, svg, function() {
					console.log('Generated SVG chart to ['+svgFilename+']');

					// now convert svg to chart image
					//convert	= spawn('convert', ['svg:'+svgFilename, 'png:'+pngFilename]);
					convert = spawn('/usr/bin/rsvg-convert', [svgFilename, '-f', 'png', '-o', pngFilename]);

convert.stdout.on('data', function (data) {
console.log('stdout: ' + data);
});

convert.stderr.on('data', function (data) {
console.log('stderr: ' + data);
});


					// When we're done, we're done
					convert.on('exit', function(code) {
    				fs.unlink(svgFilename);
						if (code == 0) {
							console.log('Converted chart to ['+pngFilename+']. Code='+code);
							callback(null);
						}
						else {
							console.log('FAILED converting chart to PNG: exit code='+code);
							callback(code);
						}
					});
				});
			});

	}

};


