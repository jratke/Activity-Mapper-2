// This script queries the location (city & state) of each activity by
// searching the first coordinate of the activity.   Locations may not have
// a "city" field in the response, so "name" is used instead.  Please don't
// abuse the search service.  This is designed to stagger the requests.
// It's designed to re-write the same cardioActivities.csv with the city/state
// data as it receives search results, and you may or may not want that behavior.
// It also strips out non-GPX activities from the output rows, and you may or
// may not want that.
//
// run:
// mkdir ./tmp
// node scripts/parse_gpx.js

const d3 = require('../node_modules/d3-dsv');
const fs = require('fs');
const wget = require('../node_modules/node-wget');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

async function main() {
  let llre = /lat\=\"([\-\d\.]+)\"\s+lon\=\"([\-\d\.]+)\"/;
  var csvfile = fs.readFileSync('./data/csv/cardioActivities.csv', 'utf8');
  var csvdata = d3.csvParse(csvfile);

  if (!csvdata.columns.includes("City"))
    csvdata.columns.push("City");
  if (!csvdata.columns.includes("State"))
    csvdata.columns.push("State");

  // Remove activities without GPX data
  csvdata = csvdata.filter(function(row) { return row["GPX File"];});

  for (let i = 0; i < csvdata.length; i++) {
    if (csvdata[i]["GPX File"] && (!csvdata[i]["City"] || !csvdata[i]["State"])) {
      let fileName = csvdata[i]["Date"].replace(" ", "-").replace(/\:/g,"") + ".gpx";
      console.log("GPX filename: " + fileName);

      let gpxData = fs.readFileSync("./data/gpx/" + fileName, 'utf8');

      // find first lat/lon pair
      var llArray = gpxData.match(llre);
      if (llArray.length > 0) {
        let queryUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + llArray[1] + "&lon=" + llArray[2] + "&zoom=10";
        console.log(queryUrl);
        await sleep(6000 + getRandomInt(500));

        let output = wget({ url: queryUrl,
               dest: './tmp/',
               //headers: { 'User-Agent': 'Mozilla/5.0' }
               headers: { 'User-Agent': 'Custom nodejs script' },
               dry: true
             },
             function(err, data) {  // data: { headers:{...}, filepath:'...' }
               if (err) {
                 console.log('--- error:');
                 console.log(err);   // error encountered
               } else {
                 //console.log('--- data:');
                 //console.log(data);
                 let js = JSON.parse(fs.readFileSync(data.filepath, 'utf8'));
                 console.log(js);
                 //if ((js.address.city || js.address.town || js.address.municipality || js.address.county || js.address.island)) {
                 //  let loc = (js.address.city || js.address.town || js.address.municipality || js.address.county || js.address.island);
                 if (js.name) {
                   let loc = js.name;
                   console.log("Got: " + loc + " state: " + js.address.state);
                   csvdata[i]["City"] = loc;
                   if (js.address.state)
                     csvdata[i]["State"] = js.address.state;

                   let outstring = d3.csvFormat(csvdata);
                   fs.writeFileSync('./data/csv/cardioActivities.csv', outstring);
                }
               }
             });
      }
    }
  }

  //let outstring = d3.csvFormat(csvdata);
  //console.log("output:");
  //console.log(outstring);
  //fs.writeFileSync('./data/csv/cardioActivitiesCities.csv', outstring);
}

main();
