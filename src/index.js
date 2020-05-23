import 'ol/ol.css';
import {Map, View, Feature} from 'ol';
import GPX from 'ol/format/GPX';
import GeoJSON from 'ol/format/GeoJSON';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import ExtentInteraction from 'ol/interaction/Extent';
import VectorImage from 'ol/layer';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import OSM from 'ol/source/OSM';
import {getHeight} from 'ol/extent';
import {getWidth} from 'ol/extent';
import {intersects} from 'ol/extent';
import { csv } from 'd3-request';

import allgpx from "../data/gpx/*.gpx";

var showRuns = true, showWalks = true, showCycling = true, showOthers = true;
var showRunsBox    = document.getElementById('show-runs');
var showWalksBox   = document.getElementById('show-walks');
var showCyclingBox = document.getElementById('show-cycling');
var showOthersBox  = document.getElementById('show-others');

var runStyle = new Style({
  stroke: new Stroke({ color: '#00f', width: 2 })
});

var cycleStyle = new Style({
  stroke: new Stroke({ color: '#f00', width: 2 })
});

var walkStyle = new Style({
  stroke: new Stroke({ color: '#0f0', width: 2 })
});

var hikeStyle = new Style({
  stroke: new Stroke({ color: '#0ff', width: 2 })
});

var otherStyle = new Style({
  stroke: new Stroke({ color: '#0f0', width: 2 })
});

var highlightStyle = new Style({
  stroke: new Stroke({ color: '#ffff00', width: 3 })    // TODO black outline around?
});

var styleMap = {
  Running: runStyle,
  Cycling: cycleStyle,
  Walking: walkStyle,
  Hiking:  hikeStyle
}

// Dictionary of activities: key = activity id
var actDict = {};

var map = new Map({
  target: 'map',
  layers: [
    new TileLayer({source: new OSM()})
  ],
  view: new View({
    center: [0,0],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
  })
});

var mextent = new ExtentInteraction();
map.addInteraction(mextent);
mextent.setActive(false);

// Enable interaction by holding shift
window.addEventListener('keydown', function(event) {
  if (event.keyCode == 16) {
    mextent.setActive(true);
  }
});
window.addEventListener('keyup', function(event) {
  if (event.keyCode == 16) {
    mextent.setActive(false);
  }
});

var lastActivitySelected = null;
var firstAct = null;
var lastClickedLayer = null;
var lastStyle = null;

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Fancy date formatting
// d is a Date object
// showDoW is a boolean that controls whether or not the Day of Week is included
// output is a string
function niceDate(d, showDoW) {
  return "" + d.getFullYear() + " " + months[d.getMonth()] + " " + d.getDate() +
     (showDoW ? " (" + days[d.getDay()] + ") " : " ") +
     ((d.getHours() > 12) ? d.getHours() - 12 : d.getHours()) + ":" +
     (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() +
     ((d.getHours() > 11) ? " pm" : " am");
}

function niceType(t) {
  if (t === "Running") return "Run";
  else if (t === "Walking") return "Walk";
  else if (t === "Cycling") return "Bike";
  else if (t === "Hiking") return "Hike";
  else return "Unknown";
}

function highlightLayer(layer) {
  if (lastClickedLayer != null) {
    lastClickedLayer.setStyle(lastStyle);
    lastClickedLayer.setZIndex(0);
  }
  lastStyle = layer.getStyle();
  layer.setStyle(highlightStyle);
  layer.setZIndex(10);
  layer.setVisible(true);  // in case it was not
  lastClickedLayer = layer;
}

// Display info about activities in the "info" area
// input is a list of activity ids
function showActs(acts,showDoW) {
  let info = [];

  if (acts.length > 0) {
    for (let i = 0; i < acts.length; i++) {
      let aid = acts[i];

      let actStr = niceDate(actDict[aid].date, showDoW) + " " + actDict[aid].type + " " +
                   actDict[aid].distance + " mi " +
                   "Dur: " + actDict[aid].duration + " " + "Pace: " + actDict[aid].avepace;
      info.push(actStr);
    }
    document.getElementById('info').innerHTML = info.join('<br>') || '(unknown)';
  }
}

// Handle when any activity on the right column is selected.
// The list element (e) has its id field set to the activity-id
// which is the key in the actDict dictionary
function activitySelected(e) {
  let aid = this.id;
  if (lastActivitySelected)
    lastActivitySelected.style.background = "transparent";
  this.style.background = "coral";
  lastActivitySelected = this;

  // modify the layer
  let layer = actDict[aid].layer;
  highlightLayer(layer);

  let actStr =
      niceDate(actDict[aid].date, true) + "<br>" +
      actDict[aid].type + "<br>" +
      "Distance " + actDict[aid].distance + " mi<br>" +
      "Duration: " + actDict[aid].duration + "<br>" +
      "Average Pace: " + actDict[aid].avepace + "<br>" +
      "Notes: " + actDict[aid].notes  + "<br>";

  map.getView().fit(layer.getSource().getExtent());
  document.getElementById('info').innerHTML = actStr;
}

csv(require('../data/csv/cardioActivities.csv'), function(error, data) {
  if (error) throw error;

  var alist = "<ul class=\"top\">";

  //for (let i = 0; i < 70; i++) {   // temp devel speed up
  for (let i = 0; i < data.length; i++) { 
      if (data[i]["GPX File"]) {
      var fileName = data[i]["Date"].replace(" ", "-").replace(/\:/g,"");

      if (allgpx[fileName]) {
        var vectSrc = new VectorSource({
          format: new GPX({
            url: allgpx[fileName],
            featureProjection: 'EPSG:3857'
          }),
          url: allgpx[fileName]
        });
        vectSrc.set('actid', data[i]["Activity Id"]);

        if (!firstAct)
          firstAct = data[i]["Activity Id"];

        // The layers (and thus their features) are loaded asynchronously
        // This is called when VectorSource actually completes loading
        // the GPX data, so we now have the feature (which contains the
        // geometry) created.
        vectSrc.on('addfeature', function(e) {
          let aid = this.get('actid');
          e.feature.set('actid', aid);

          // position the map based on the most recent activity
          // (which is assumed to be the first one in the csv file)
          if (aid == firstAct)
            map.getView().fit(this.getExtent());
        });

        let layer = new VectorLayer({
          source: vectSrc,
          style: styleMap[data[i]["Type"]],
        });
        map.addLayer(layer);

        let date = new Date(Date.parse(data[i]["Date"]));
        actDict[data[i]["Activity Id"]] = {
          avepace: data[i]["Average Pace"],
          date: date,
          distance: data[i]["Distance (mi)"],
          duration: data[i]["Duration"],
          notes: data[i]["Notes"],
          type: data[i]["Type"],
          city: data[i]["City"],
          state: data[i]["State"],
          layer: layer
        };

        alist += "<li id=\"" + data[i]["Activity Id"] + "\">" + niceDate(date,false) +
                 " - " + niceType(data[i]["Type"]);
        if (data[i]["City"])
          alist += " - " + data[i]["City"]; // + "," + data[i]["State"];
        alist += "</li>";
      }
      else {
        console.log("missing .gpx file in data/gpx/ for activity " + fileName);
      }
    }
  }

  console.log('cardioActivities CSV data length ' + data.length);
  console.log('Activites from CSV with GPS data: ' + Object.keys(actDict).length);
  console.log('Number of gpx files in data/gpx/ '+ Object.keys(allgpx).length);
  alist += "</ul>";

  var htmlAList = document.getElementById('actlist');
  htmlAList.innerHTML = alist;
  var ulTop = htmlAList.childNodes;
  if (ulTop.length == 1 && ulTop[0].className == "top") {
    var nodeList = ulTop[0].childNodes;
    for (let i = 0; i < nodeList.length; i++) {
      let aid = nodeList[i].id;
      nodeList[i].style.color = styleMap[actDict[aid].type].getStroke().getColor();
      nodeList[i].style.cursor = "pointer";
      nodeList[i].onclick = activitySelected;
    }
  }
});


function doToggle() {
  map.getLayers().forEach((layer, index, array) => {
    if (layer instanceof VectorLayer) {
      let src = layer.getSource();
      let ftrs = src.getFeatures();
      if (ftrs.length > 0) {
        let name = ftrs[0].get('name');
        if (name.startsWith('Run'))
          layer.setVisible(showRuns);
        else if (name.startsWith('Cycling'))
          layer.setVisible(showCycling);
        else if (name.startsWith('Walk'))
          layer.setVisible(showWalks);
        else
          layer.setVisible(showOthers);
      }
    }
  });
}

function setAllLayers(vis) {
  map.getLayers().forEach((layer) => {
    if (layer instanceof VectorLayer)
      layer.setVisible(vis);
  });
}

function toggleRuns() {
  showRuns = !showRuns;
  doToggle();
}

function toggleWalks() {
  showWalks = !showWalks;
  doToggle();
}

function toggleCycling() {
  showCycling = !showCycling;
  doToggle();
}

function toggleOthers() {
  showOthers = !showOthers;
  doToggle();
}

showRunsBox.addEventListener('change', toggleRuns);
showWalksBox.addEventListener('change', toggleWalks);
showCyclingBox.addEventListener('change', toggleCycling);
showOthersBox.addEventListener('change', toggleOthers);
document.getElementById('hide-all').onclick = function() { setAllLayers(false); };
document.getElementById('show-all').onclick = function() { setAllLayers(true); };

function displayFeatureInfo(pixel) {
  var acts = [];
  map.forEachFeatureAtPixel(pixel, function(feature) {
    // features can include the interaction extent and its circle
    if (feature.get('actid'))
      acts.push(feature.get('actid'));
  });

  if (acts.length > 0) {
    // intended to hide any active interaction extent
    mextent.setActive(false);
    showActs(acts, false);
  } else {
    //document.getElementById('info').innerHTML = '&nbsp;';
  }
};

map.on('pointermove', function(evt) {
  if (evt.dragging) {
    return;
  }
  var pixel = map.getEventPixel(evt.originalEvent);
  displayFeatureInfo(pixel);
});


mextent.on('extentchanged', function(evt) {
  //console.log("extend changed   active?: " + this.getActive() + " box: " + this.getExtent());
  if (this.getActive() && this.getExtent() &&
      getWidth(this.getExtent()) > 0 && getHeight(this.getExtent()) > 0) {
    //console.log("look at activites in mextent "); // + this.getExtent());
    var acts = [];
    // Seems pretty brute-force, but somehow works efficiently
    map.getLayers().forEach((layer, index, array) => {
      if (layer instanceof VectorLayer) {
          let ftrs = layer.getSource().getFeatures();
          if (ftrs.length > 0) {
            if (ftrs[0].getGeometry().intersectsExtent(this.getExtent())) {
              acts.push(ftrs[0].get('actid'));
            }
          }
      }
    });

    //console.log("found " + acts.length + " activites in mextent"); // and they are: " + acts);
    showActs(acts, true);
    mextent.setActive(false);
  }
});

map.on('click', function(evt) {
  var acts   = [];
  var layers = [];

  map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
    // Each point in a gpx plot's multi-line geometry actually contains
    //  4 values: lat, lon, elevation, and time ("M")
    //let firstCoord = features[i].getGeometry().getFirstCoordinate();
    //if (firstCoord.length == 4) {
    //  var date = new Date(firstCoord[3]*1000);
    //  console.log("date: " + date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() +
    //    "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds())
    //}

    // features can include the interaction extent and its circle, so ignore those
    if (feature.get('actid')) {
      acts.push(feature.get('actid'));
      layers.push(layer);
    }
  });

  if (acts.length > 0 && layers.length > 0) {
    let act = acts[acts.length - 1];
    let layer = layers[layers.length - 1];

    mextent.setActive(false);

    // Update timeline list selection
    if (lastActivitySelected)
      lastActivitySelected.style.background = "transparent";
    let elem = document.getElementById(layer.getSource().get('actid'));
    elem.style.background = "coral";
    lastActivitySelected = elem;

    highlightLayer(layer);
  }

});
