
/**
 * Module dependencies.
 */

var express = require('express'),
		fs = require('fs'),
		chart = require('./chart'),
		PDF = require("node-wkhtml").pdf(),
		http = require('http');


var app = module.exports = express.createServer();

var host = process.env.VCAP_APP_HOST || 'localhost';
var port = Number(process.env.VCAP_APP_PORT || 3000);

var tempfolder = __dirname + '/tmp';


// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});


function buildChartFilename(chartId) {
		return tempfolder + '/_chart_'+chartId+'.png';
}

// Chart ID
var _firstChartId = 1;
var _nextChartId = _firstChartId;
function getNextChartId() {
	if (_nextChartId >= 99999)
		_nextChartId = _firstChartId;
	return _nextChartId++;
}

// Keep SVG content in this map during processing. Keyed by chart ID
var _svgMap = {};


//tmp
//_svgMap[66] = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="640" height="480" style="background-color:#000; width:640px; height:480px;"><desc>Created with Raphaël</desc><defs><linearGradient id="r-91b4a4bca23947aca716b87cb5c25c80" x1="0" y1="1" x2="6.123233995736766e-17" y2="0"><stop offset="0%" stop-color="#0000ff"></stop><stop offset="100%" stop-color="#0000ff" stop-opacity="0"></stop></linearGradient></defs><path fill="url(#r-91b4a4bca23947aca716b87cb5c25c80)" stroke="none" d="M50,240.00000000000003C50,240.00000000000003,98.33333333333334,428,146.66666666666669,428C195,428,195.12348741152624,243.45280571517276,243.33333333333334,240.00000000000003C291.54317925514044,236.54719428482733,291.6666666666667,376,340,376C388.33333333333337,376,400.6871052132315,272.2735537046913,436.6666666666667,240.00000000000003C472.6462281201019,207.72644629530873,485,186.00000000000003,533.3333333333334,186.00000000000003C581.6666666666667,186.00000000000003,630,240.00000000000003,630,240.00000000000003L630,470L50,470Z" opacity="1" fill-opacity="1" style="opacity: 1; fill-opacity: 1; " stroke-opacity="0"></path><path fill="none" stroke="#0000ff" d="M50,240.00000000000003C50,240.00000000000003,98.33333333333334,428,146.66666666666669,428C195,428,195.12348741152624,243.45280571517276,243.33333333333334,240.00000000000003C291.54317925514044,236.54719428482733,291.6666666666667,376,340,376C388.33333333333337,376,400.6871052132315,272.2735537046913,436.6666666666667,240.00000000000003C472.6462281201019,207.72644629530873,485,186.00000000000003,533.3333333333334,186.00000000000003C581.6666666666667,186.00000000000003,630,240.00000000000003,630,240.00000000000003" style="stroke-width: 2px; " stroke-width="2"></path><circle cx="50" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="50" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="146.66666666666669" cy="428" r="5" fill="#0000ff" stroke="none"></circle><circle cx="146.66666666666669" cy="428" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="243.33333333333334" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="243.33333333333334" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="340" cy="376" r="5" fill="#0000ff" stroke="none"></circle><circle cx="340" cy="376" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="436.6666666666667" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="436.6666666666667" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="533.3333333333334" cy="186.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="533.3333333333334" cy="186.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="630" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="630" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle></svg>';


// Get a PNG out of a given SVG
// Takes a string (SVG content) and invokes the callback with a Buffer containing the PNG data
function svg2png(svg, callback) {

		var escapedSvg = 'svg=' + escape(svg);

		var options = {
			host: 'ilab-converter.cloudfoundry.com',
			port: 80,
			path: '/svg/convertToPNG',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': escapedSvg.length
			}
		};

		console.log('Converting SVG ('+svg.length+' bytes) to PNG');

		var creq = http.request(options, function(cres) {
//				console.log('STATUS: ' + cres.statusCode);
//				console.log('hrd ' + cres.headers);

				var contentLen = parseInt(cres.headers['content-length']);
//				console.log('hrd CL: ' + contentLen);

				var pngBuffer = new Buffer(contentLen);
				var pngBufferPos = 0;


				cres.on('data', function (chunk) {
					chunk.copy(pngBuffer, pngBufferPos);
					pngBufferPos += chunk.length;
//					console.log("pngBufferPos = "+pngBufferPos);
//					console.log('BODY: written '+chunk.length+' bytes to buffer');
				});
				
				cres.on('end', function() {
//					console.log('done');
//					res.send(pngBuffer, {'Content-Type':'image/png'}, 200);
						callback(pngBuffer);
				});
		});

		creq.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			callback(null);
		});

		// write data to request body
		creq.write(escapedSvg);
		creq.end();
}


// Routes

app.get('/', function(req, res){
  res.send('<html><body><h2>iLab!</h2></body></html>');
});


/*
app.get('/chart-test', function(req,res){

		var options = {
		      chart: {
		          width: 300,
		          height: 300,
		          defaultSeriesType: 'bar'
		      },
		      legend: {
		          enabled: false
		      },
		      title: {
		          text: 'Highcharts rendered by Node!'
		      },
		      series: [{
		          data: [ 1, 2, 3, 4, 5, 6 ]
		      }]
		  };

		var chartFilename = __dirname+'/__chart.png';

		chart.exportToPng(options, chartFilename, function(err, data) {
		    if (err) {
 		      res.send(500);
    		} else {
    			res.contentType('image/png');
    			res.sendfile(chartFilename, function(err) {
    				//..
    				fs.unlink(chartFilename);
    			});
				}
		});
	
});
*/

/*
app.get('/chart/:id', function(req,res){

	var chartFilename = buildChartFilename(req.params.id);
	console.log("Serving chart image: "+chartFilename);
	fs.stat(chartFilename, function(err,stats){
		if (err != null)
			res.send(500);
		else {
 			res.contentType('image/png');
 			res.sendfile(chartFilename, function(err) {
 				//console.log("Serving chart png error:"+err);
			});
		}
	});

});
*/

/*
app.get('/chart/:id', function(req,res){

	var chartId = req.params.id;
	var svg = _svgMap[chartId];
	if (svg) {
	
		// done with this one, remove it from map
		_svgMap[chartId] = null;

		// temp chart png filename
		var chartFilename = buildChartFilename(chartId);

		// export our SVG to PNG
		chart.exportSvgToPng(svg, chartFilename, function(err) {
		    if (err) {
 		      res.send(500);
    		} else {
    			res.contentType('image/png');
    			res.sendfile(chartFilename, function(err) {
    				fs.unlink(chartFilename);
    			});
				}
		});
	
	}
	else {
		res.send(500);
	}

});
*/

function renderPdfTemplate(res, chartFilename, callback) {
		fs.readFile(chartFilename, function(err,data){
			var buf = new Buffer(data, 'binary').toString('base64');

			res.render('pdftmpl', {layout:false, chart_data:buf});

			if (callback)
				callback();
		});
}

app.get('/pdf/tmpl/:id', function(req,res){

	var cid = req.params.id;
	var svg = _svgMap[cid];
	if (svg) {
	
		// done with this one, remove it from map
		_svgMap[cid] = null;


		if (svg == 'test') {
			renderPdfTemplate(res, tempfolder+'/test.png');
		}
		else {

			svg2png(svg, function(pngBuffer) {
				if (pngBuffer == null)
					res.send(500);
				else
					res.render('pdftmpl', {layout:false, chart_data:pngBuffer.toString('base64')});
			});

		}
	}
	else {
		res.send(500);
	}

});

app.get('/pdf/:cid', function(req,res){

		var cid = req.params.cid;
		
		var pdfFilename = tempfolder+'/_page.pdf';
		fs.unlink(pdfFilename);

		var url = 'http://'+host+':'+port+'/pdf/tmpl/'+cid;
		new PDF({url: url}).convertAs(pdfFilename, function(err, out) {
			if (err != null) {
				console.log("ERROR:"+err);
				res.send(500);
			}
			else {
				res.contentType('application/pdf');
   			res.sendfile(pdfFilename, function(err) {
					fs.unlink(pdfFilename);
   			});
   		}
		});

});

app.post('/pdf', function(req,res){

		var svg = req.body.svg;
		var cid = getNextChartId();

		_svgMap[cid] = svg;

		res.redirect('/pdf/'+cid);
});


app.get('/test', function(req,res){
	res.render('pdf.jade', {layout:false});
});

app.get('/test/chart', function(req,res) {

		var svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="640" height="480" style="background-color:#000; width:640px; height:480px;"><desc>Created with Raphaël</desc><defs><linearGradient id="r-91b4a4bca23947aca716b87cb5c25c80" x1="0" y1="1" x2="6.123233995736766e-17" y2="0"><stop offset="0%" stop-color="#0000ff"></stop><stop offset="100%" stop-color="#0000ff" stop-opacity="0"></stop></linearGradient></defs><path fill="url(#r-91b4a4bca23947aca716b87cb5c25c80)" stroke="none" d="M50,240.00000000000003C50,240.00000000000003,98.33333333333334,428,146.66666666666669,428C195,428,195.12348741152624,243.45280571517276,243.33333333333334,240.00000000000003C291.54317925514044,236.54719428482733,291.6666666666667,376,340,376C388.33333333333337,376,400.6871052132315,272.2735537046913,436.6666666666667,240.00000000000003C472.6462281201019,207.72644629530873,485,186.00000000000003,533.3333333333334,186.00000000000003C581.6666666666667,186.00000000000003,630,240.00000000000003,630,240.00000000000003L630,470L50,470Z" opacity="1" fill-opacity="1" style="opacity: 1; fill-opacity: 1; " stroke-opacity="0"></path><path fill="none" stroke="#0000ff" d="M50,240.00000000000003C50,240.00000000000003,98.33333333333334,428,146.66666666666669,428C195,428,195.12348741152624,243.45280571517276,243.33333333333334,240.00000000000003C291.54317925514044,236.54719428482733,291.6666666666667,376,340,376C388.33333333333337,376,400.6871052132315,272.2735537046913,436.6666666666667,240.00000000000003C472.6462281201019,207.72644629530873,485,186.00000000000003,533.3333333333334,186.00000000000003C581.6666666666667,186.00000000000003,630,240.00000000000003,630,240.00000000000003" style="stroke-width: 2px; " stroke-width="2"></path><circle cx="50" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="50" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="146.66666666666669" cy="428" r="5" fill="#0000ff" stroke="none"></circle><circle cx="146.66666666666669" cy="428" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="243.33333333333334" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="243.33333333333334" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="340" cy="376" r="5" fill="#0000ff" stroke="none"></circle><circle cx="340" cy="376" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="436.6666666666667" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="436.6666666666667" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="533.3333333333334" cy="186.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="533.3333333333334" cy="186.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle><circle cx="630" cy="240.00000000000003" r="5" fill="#0000ff" stroke="none"></circle><circle cx="630" cy="240.00000000000003" r="41.42857142857143" fill="#ffffff" stroke="none" style="opacity: 0; cursor: move; " opacity="0"></circle></svg>';

		svg2png(svg, function(pngBuffer) {

				if (pngBuffer == null) {
					res.send(500);
				}
				else {
					res.send(pngBuffer, {'Content-Type':'image/png'}, 200);
				}
		});

});

/*
app.get('/pdf3', function(req,res){

		var pdfFilename = tempfolder+'/_page.pdf';
		fs.unlink(pdfFilename);

		var url = 'http://'+host+':'+port+'/pdf/tmpl/'+'3';

//		var html = '<html><body><div style="border:1px solid #000;"><img src="chart/3"></img></div></body></html>';

		new PDF({url: url}).convertAs(pdfFilename, function(err, out) {
//		new PDF({file: "/home/laurent/ilab/pdf.html"}).convertAs(pdfFilename, function(err, out) {
//		new PDF({html: html}).convertAs(pdfFilename, function(err, out) {
//		new PDF({url: 'http://localhost:3000/pdfc'}).convertAs(pdfFilename, function(err, out) {
			if (err != null) {
				console.log("ERROR:"+err);
				res.send(500);
			}
			else {
				res.contentType('application/pdf');
   			res.sendfile(pdfFilename, function(err) {
					fs.unlink(pdfFilename);
   			});
   		}
		});

});
*/


app.listen(port, host);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);