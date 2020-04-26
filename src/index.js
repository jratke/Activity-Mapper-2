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
  stroke: new Stroke({ color: '#000', width: 3 })
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

function myStyleFunction(feature, resolution) {
  const name = feature.get('name');
  return name.startsWith('Run') ? runStyle :
         name.startsWith('Walk') ? walkStyle :
         name.startsWith('Cycl') ? cycleStyle : otherStyle;
}

var lastActivitySelected = null;
var firstAct = null;
var lastClickedLayer;

function hightlightLayer(layer) {
  if (lastClickedLayer != null) {
    lastClickedLayer.setStyle(myStyleFunction);
    lastClickedLayer.setZIndex(0);
  }
  layer.setStyle(clickStyle);
  layer.setZIndex(10);
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
  hightlightLayer(layer);

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

        // This "works", but unfortuantely doesn't do anything useful because
        // it can't be looked up by getting the features at a certain pixel.
        vectSrc.addFeature(new Feature({ actid: data[i]["Activity Id"] }));

        let layer = new VectorLayer({
          source: vectSrc,
          style: styleMap[data[i]["Type"]],
          //actid: data[i]["Activity Id"]
        });
        map.addLayer(layer);

        actDict[data[i]["Activity Id"]] = {
          avepace: data[i]["Average Pace"],
          date: data[i]["Date"],
          distance: data[i]["Distance (mi)"],
          duration: data[i]["Duration"],
          notes: data[i]["Notes"],
          type: data[i]["Type"],
          //vsrc: vectSrc,
          layer: layer
        };

        alist += "<li id=\"" + data[i]["Activity Id"] + "\">" + data[i]["Date"] + " - " + data[i]["Type"] + "</li>";

        // TODO position the map based on the most recent activity
        // (which is assumed to be the first one in the csv file)
        // Unfortunately the layers (and thus their features) are loaded
        // asynchronously, so the extent does not seem to be available
        // at the time that this runs.
        if (!firstAct) {
          firstAct = data[i]["Activity Id"];
          //var feature = actDict[firstAct].vsrc.getFeatures()[0];
          //console.log("first feature of first activity: " + feature);
          //var polygon = feature.getGeometry();
          //console.log("first polygon of first feature: " + polygon);
          //map.getView().fit(vectSrc.getExtent());
        }

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

  //console.log("first act extent: " + actDict[firstAct].vsrc.getExtent());
});


var displayFeatureInfo = function(pixel) {
  var features = [];
  map.forEachFeatureAtPixel(pixel, function(feature) {
  	features.push(feature);
  });

  //var aFeature = null;

  if (features.length > 0) {
    var info = [];
    var aids = [];
    var i, ii;
    for (i = 0, ii = features.length; i < ii; ++i) {
      info.push(features[i].get('name'));
      //aids.push(features[i].get('actid'));
    }
    document.getElementById('info').innerHTML = info.join(', ') || '(unknown)';

    //if (aids.length)
    //  console.log("feature actids: " + aids.join(', '));
  } else {
    document.getElementById('info').innerHTML = '&nbsp;';
  }
};

var highlightFeatures = function(pixel) {
  // TODO just find the last feature and highlight that.
  map.forEachFeatureAtPixel(pixel, function(feature, layer) {
    hightlightLayer(layer);
  });
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

map.on('pointermove', function(evt) {
  if (evt.dragging) {
    return;
  }
  var pixel = map.getEventPixel(evt.originalEvent);
  displayFeatureInfo(pixel);
});

map.on('click', function(evt) {
  displayFeatureInfo(evt.pixel);
  highlightFeatures(evt.pixel);
});
