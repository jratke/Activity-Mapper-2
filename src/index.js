import 'ol/ol.css';
import {Map, View, Feature} from 'ol';
import GPX from 'ol/format/GPX';
import GeoJSON from 'ol/format/GeoJSON';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import VectorImage from 'ol/layer';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import OSM from 'ol/source/OSM';
import {fromLonLat} from 'ol/proj';
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

var clickStyle = new Style({
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

var view = new View({
  center: fromLonLat([-87.6298, 41.8781]),
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

var map = new Map({
  target: 'map',
  layers: [
    new TileLayer({source: new OSM()})
  ],
  view: view
});

var lastActivitySelected = null;
var firstAct = null;
var lastClickedLayer = null;
var lastStyle = null;

function highlightLayer(layer) {
  if (lastClickedLayer != null) {
    lastClickedLayer.setStyle(lastStyle);
    lastClickedLayer.setZIndex(0);
  }
  lastStyle = layer.getStyle();
  layer.setStyle(clickStyle);
  layer.setZIndex(10);
  layer.setVisible(true);  // in case it was not
  lastClickedLayer = layer;
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

  let extent = actDict[aid].layer.getSource().getExtent();  //actDict[aid].vsrc.getExtent();

  let actStr = actDict[aid].date + " " + actDict[aid].type + "<br>" +
      "Distance (mi) " + actDict[aid].distance + "<br>" +
      "Duration: " + actDict[aid].duration + "<br>" +
      "Average Pace: " + actDict[aid].avepace + "<br>" +
      "Notes: " + actDict[aid].notes  + "<br>";
      // + "Extent: " + extent;

  map.getView().fit(extent);
  document.getElementById('info').innerHTML = actStr;
}

csv(require('../data/csv/cardioActivities.csv'), function(error, data) {
  if (error) throw error;

  var alist = "<ul class=\"top\">";

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

        if (!firstAct) {
          firstAct = data[i]["Activity Id"];
        }

        // The layers (and thus their features) are loaded asynchronously
        // This is called when VectorSource actually completes loading
        // the GPX data, so we now have the feature (which contains the
        // geometry) created.
        vectSrc.on('addfeature', function(e) {
          //console.log(this.get('actid') + " is now " + vectSrc.getState());
          let aid = this.get('actid');
          e.feature.set('actid', aid);

          if (aid == firstAct) {
            //console.log("first activity " + aid + "loaded and its extent is: " + this.getExtent());
            // position the map based on the most recent activity
            // (which is assumed to be the first one in the csv file)
            map.getView().fit(this.getExtent());
          }
        });

        let layer = new VectorLayer({
          source: vectSrc,
          style: styleMap[data[i]["Type"]],
        });
        map.addLayer(layer);

        // This doesn't make things much faster
        //layer.once('change', function(e) {
        //  if (!intersects(this.getSource().getExtent(), map.getView().calculateExtent()))
        //    this.setVisible(false);
        //});

        actDict[data[i]["Activity Id"]] = {
          avepace: data[i]["Average Pace"],
          date: data[i]["Date"],
          distance: data[i]["Distance (mi)"],
          duration: data[i]["Duration"],
          notes: data[i]["Notes"],
          type: data[i]["Type"],
          layer: layer
        };

        alist += "<li id=\"" + data[i]["Activity Id"] + "\">" + data[i]["Date"] + " - " + data[i]["Type"] + "</li>";
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


var displayFeatureInfo = function(pixel) {
  var acts = [];
  var info = [];

  map.forEachFeatureAtPixel(pixel, function(feature) {
    acts.push(feature.get('actid'));
  });

  if (acts.length > 0) {
    for (var i = 0; i < acts.length; i++) {
      // Unfortunately, GPX format does not parse the <time> tag from a <trk> tag like it parses <name>
      //info.push(features[i].get('time'));
      // but we manually added the "actid" to each feature as it was loaded

      // Amazingly, coordinate contains 4 values:  lat, lon, elevation, and time ("M")
      /*
      let firstCoord = features[i].getGeometry().getFirstCoordinate();
      if (firstCoord.length == 4) {
        var date = new Date(firstCoord[3]*1000);
        console.log("date: " + date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds())
        // date.getDay will give day of week
      }
      */

      let aid = acts[i];
      let actStr = actDict[aid].date + " " + actDict[aid].type + " " + actDict[aid].distance + " mi " +
                  "Dur: " + actDict[aid].duration + " " + "Pace: " + actDict[aid].avepace;
      info.push(actStr);
    }
    document.getElementById('info').innerHTML = info.join('<br>') || '(unknown)';
  } else {
    document.getElementById('info').innerHTML = '&nbsp;';
  }
};

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
    if (layer instanceof VectorLayer) {
      layer.setVisible(vis);
    }
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

map.on('pointermove', function(evt) {
  if (evt.dragging) {
    return;
  }
  var pixel = map.getEventPixel(evt.originalEvent);
  displayFeatureInfo(pixel);
});

map.on('click', function(evt) {
  var acts   = [];
  var layers = [];

  map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
    acts.push(feature.get('actid'));
    layers.push(layer);
  });

  if (acts.length > 0 && layers.length > 0) {
    let act = acts[acts.length - 1];
    let layer = layers[layers.length - 1];

    // Update timeline list selection
    if (lastActivitySelected)
      lastActivitySelected.style.background = "transparent";
    let elem = document.getElementById(layer.getSource().get('actid'));
    elem.style.background = "coral";
    lastActivitySelected = elem;

    highlightLayer(layer);
  }
});
