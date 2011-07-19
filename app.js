
/**
 * Module dependencies.
 */
require('coffee-script');

var express = require('express'),
		fs = require('fs'),
		http = require('http'),
//		nodestatic = require('node-static'),
		PDFDocument = require('pdfkit');

var app = module.exports = express.createServer();

// Configuration

var host = process.env.VCAP_APP_HOST || 'localhost';
var port = process.env.PORT || 3000;

var tempFolder = (port == 3000 ? __dirname+'/tmp' : '/tmp');
//var latestSvgFilename = tempFolder + '/_latest.svg';
var latestSVG = null;

// Ensure tmp folder exists
fs.mkdir(tempFolder, 0755);


app.configure(function(){
  app.set('views', './views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static('./public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

/*
// STATIC FILE SERVER

var staticServer = new nodestatic.Server('./public');

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        //
        // Serve files!
        //
        file.serve(request, response);
    });
}).listen(8080);
*/

// HELPERS

function buildChartFilename(chartId) {
		return tempFolder + '/chart_'+chartId+'.png';
}
function buildPdfFilename(id) {
		return tempFolder + '/report_'+id+'.pdf';
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

				var contentLen = parseInt(cres.headers['content-length']);

				var pngBuffer = new Buffer(contentLen);
				var pngBufferPos = 0;


				cres.on('data', function (chunk) {
					chunk.copy(pngBuffer, pngBufferPos);
					pngBufferPos += chunk.length;
				});
				
				cres.on('end', function() {
						callback(pngBuffer);
				});
		});

		creq.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			callback(null);
		});

		creq.write(escapedSvg);
		creq.end();
}

function buildPdf(pdfFilename, chartFilename, callback) {

		var doc = new PDFDocument();

		var pageW = 612;
		var pageH = 792;

		doc.fontSize(10);
		doc.text('iLab Report 2011', 50,30);
		doc.text('Page 1', 50, 30, { 'width':pageW-100, 'align':'right' });
		doc.moveTo(48,46).lineTo(pageW-48,46).stroke();

		doc.fontSize(22);
		doc.text('Sports Report', 10, 90, { 'width':pageW-20, 'align':'center' });

		doc.fontSize(10);
    console.log("CONVERTING " + chartFilename);
		doc.image(chartFilename, 100, 140, { 'fit':[400, 400] } )
			 .rect(100, 140, 400, 400)
			 .stroke()
			 .text('Nascar vs Footbal comparison', 100, 550, { 'width':400, 'align':'center' });


		doc.write(pdfFilename, function() {
			console.log("PDF written to file");
			callback();
		});

}



// Routes

//app.get('/', function(req, res){
//  res.send('<html><body><h2>iLab!</h2></body></html>');
//});


app.get('/pdf/:id', function(req,res){

		var id = req.params.id;

		var pdfFilename = buildPdfFilename(id);

		res.contentType('application/pdf');
		res.sendfile(pdfFilename, function(err) {
				console.log("sent response: err="+err);
				fs.unlink(pdfFilename);
		});

});

app.post('/pdf', function(req,res){

		var svg = req.body.svg;
		var cid = getNextChartId();

		latestSVG = svg;
    console.log("RECEIVED SVG: " + svg);
//		fs.writeFile(latestSvgFilename, svg, 'utf8', function(err) {

			svg2png(svg, function(pngBuffer) {
				if (pngBuffer == null) {
					res.send(500);
				}
				else {

					var chartFilename = buildChartFilename(cid);
				 	console.log("Using chart file name: " + chartFilename);
					fs.writeFile(chartFilename, pngBuffer, function() {

							var pdfFilename = buildPdfFilename(cid);
				 	    console.log("Using pdf file name: " + pdfFilename);
							fs.unlink(pdfFilename);

							buildPdf(pdfFilename, chartFilename, function() {
							
				 				console.log("Sending response...");
								fs.unlink(chartFilename);

								res.redirect('/pdf/'+cid);

							});

					});
				}
			});
//		});
});


app.get('/test', function(req,res){

//	fs.readFile(latestSvgFilename, function(err,data) {
		
			res.render('pdf.jade', {layout:false, svg:latestSVG});
	
//	});

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


app.listen(port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
