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

import allgpx from "../data/gpx/*.gpx";

var myassets = Object.entries(allgpx);

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

var otherStyle = new Style({
  stroke: new Stroke({ color: '#0f0', width: 2 })
});

var clickStyle = new Style({
  stroke: new Stroke({ color: '#000', width: 3 })
});

var map = new Map({
  target: 'map',
  layers: [
    new TileLayer({source: new OSM()})
  ],
  view: new View({
    center: fromLonLat([-87.6298, 41.8781]),
      zoom: 10,
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

for (var i = 0; i < myassets.length; i++) {
    var gpx = new GPX({
      url: myassets[i][1],
      featureProjection: 'EPSG:3857'});

    var src = new VectorSource({
      format: gpx,
      url: myassets[i][1]});

    map.addLayer(new VectorLayer({
        source: src,
        style: myStyleFunction
    }));
}

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
