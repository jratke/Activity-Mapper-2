import 'ol/ol.css';
import {Map, View} from 'ol';
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
var showRunsBox = document.getElementById('show-runs');
var showWalksBox = document.getElementById('show-walks');
var showCyclingBox = document.getElementById('show-cycling');
var showOthersBox = document.getElementById('show-others');

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

var map = new Map({
  target: 'map',
  layers: [
    new TileLayer({source: new OSM()})
  ],
  view: new View({
    center: fromLonLat([-87.6298, 41.8781]),
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
  })
});

function myStyleFunction(feature, resolution) {
  const name = feature.get('name');
  return name.startsWith('Run') ? runStyle :
         name.startsWith('Walk') ? walkStyle :
         name.startsWith('Cycl') ? cycleStyle : otherStyle;
}

function actClicked(e) {
  console.log("element " + this.id + " clicked");

  let aid = this.id;
  let actStr = actDict[aid].date + " " + actDict[aid].type;
  document.getElementById('info').innerHTML = actStr;
}

var activitiesWithGPX = 0;
var activitiesWithoutGPX = 0;
csv(require('../data/csv/cardioActivities.csv'), function(error, data) {
  if (error) throw error;

  var alist = "<ul class=\"top\">";
  for (let i = 0; i < data.length; i++) {
    if (data[i]["GPX File"]) {
      activitiesWithGPX++;

      /*
      var daytime = data[i]["Date"].split(" ", 2);
      var day = daytime[0].split("-", 3);
      var yy = day[0];
      var mm = day[1];
      var dd = day[2];
      var atype = data[i]["Type"];
      var actObj = new Object;
      */
      var fileName = data[i]["Date"].replace(" ", "-").replace(/\:/g,"");

      var gpx = new GPX({
        url: allgpx[fileName],
        featureProjection: 'EPSG:3857'
      });

      var vectSrc = new VectorSource({
        format: gpx,
        url: allgpx[fileName]
      });

      map.addLayer(new VectorLayer({
        source: vectSrc,
        style: styleMap[data[i]["Type"]] //myStyleFunction
      }));

      actDict[data[i]["Activity Id"]] = {
        date: data[i]["Date"],
        distance: data[i]["Distance (mi)"],
        duration: data[i]["Duration"],
        notes: data[i]["Notes"],
        type: data[i]["Type"],
        vsrc: vectSrc,
        //url: allgpx[fileName]    don't need this, anyway it's in the vectSrc
      };

      alist += "<li id=\"" + data[i]["Activity Id"] + "\">" + data[i]["Date"] + " - " + data[i]["Type"] + "</li>";
    } else {
      activitiesWithoutGPX++;
    }
  }
  console.log('Activites with GPS data: ' + activitiesWithGPX);
  console.log('Activites without GPS data: ' + activitiesWithoutGPX);
  alist += "</ul>";

  var htmlAList = document.getElementById('actlist');
  htmlAList.innerHTML = alist;

  var ulTop = htmlAList.childNodes;
  if (ulTop.length == 1 && ulTop[0].className == "top") {
    var nodeList = ulTop[0].childNodes;
    for (let i = 0; i < nodeList.length; i++) {
      // TODO: use the map?
      if (actDict[nodeList[i].id].type == "Running") {
        nodeList[i].style.color = "blue";
      } else if (actDict[nodeList[i].id].type == "Cycling") {
        nodeList[i].style.color = "red";
      } else if (actDict[nodeList[i].id].type == "Walking") {
        nodeList[i].style.color = "green";
      }

      nodeList[i].onclick = actClicked;
    }
  }

});

var lastClickedLayer;

var displayFeatureInfo = function(pixel) {
  var features = [];
  map.forEachFeatureAtPixel(pixel, function(feature) {
  	features.push(feature);
  });

  if (features.length > 0) {
    var info = [];
    var i, ii;
    for (i = 0, ii = features.length; i < ii; ++i) {
      info.push(features[i].get('name'));
    }
    document.getElementById('info').innerHTML = info.join(', ') || '(unknown)';
  } else {
    document.getElementById('info').innerHTML = '&nbsp;';
  }
};

var highlightFeatures = function(pixel) {
  map.forEachFeatureAtPixel(pixel, function(feature, layer) {
    if (lastClickedLayer != null) {
      lastClickedLayer.setStyle(myStyleFunction);
      lastClickedLayer.setZIndex(0);
    }
    layer.setStyle(clickStyle);
    layer.setZIndex(10);
    lastClickedLayer = layer;
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
  console.log(evt.pixel);
  displayFeatureInfo(evt.pixel);
  highlightFeatures(evt.pixel);
});
