import 'ol/ol.css';
import {Map, View} from 'ol';
import GPX from 'ol/format/GPX';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {DragBox, Select} from 'ol/interaction';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import OSM from 'ol/source/OSM';
import BingMaps from 'ol/source/BingMaps';
import XYZ from 'ol/source/XYZ';
import {platformModifierKeyOnly} from 'ol/events/condition';
import {Attribution, defaults as defaultControls} from 'ol/control';

import { csv } from 'd3-request';
import allgpx from "../data/gpx/*.gpx";

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
  stroke: new Stroke({ color: '#0ff', width: 2 })
});

var styleMap = {
  Running: runStyle,
  Cycling: cycleStyle,
  Walking: walkStyle,
  Hiking:  hikeStyle,
  Rowing:  otherStyle
}

var baseStyles = [
  'OSM',
  'RoadOnDemand',
  'Aerial',
  'AerialWithLabelsOnDemand',
  'ArcGIS' ];

var baseLayers = [];
baseLayers.push(
  new TileLayer({source: new OSM()})
);

for (var i = 1; i < baseStyles.length - 1; ++i) {
  baseLayers.push(
    new TileLayer({
      visible: false,
      preload: 0, //Infinity,
      source: new BingMaps({
        key: 'Your Bing Maps Key from http://www.bingmapsportal.com/ here',
        imagerySet: baseStyles[i],
        // Open Layers docs say to use maxZoom 19 to see stretched tiles instead of
        // the BingMaps "no photos at this zoom level" tiles, but I limit maxZoom
        // to 18 in general.
        // maxZoom: 19
      }),
    })
  );
}

baseLayers.push(
  new TileLayer({
    visible: false,
    source: new XYZ({
      attributions: 'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 18
    })
  })
);

var infoBox = document.getElementById('info');
var mInfoBox = document.getElementById('mouseinfo');

// Dictionary of activities: key = activity id
var actDict = {};

// Need to make a custom Attribution to override "collapsible"
var attribution = new Attribution({
  collapsible: true,
});

var map = new Map({
  target: 'map',
  layers: baseLayers,
  controls: defaultControls({attribution: false}).extend([attribution]),
  view: new View({
    center: [0,0],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
  })
});

var layerSelect = document.getElementById('layer-select');
function onBaseLayerChange() {
  var style = layerSelect.value;
  for (var i = 0; i < baseLayers.length; ++i) {
    baseLayers[i].setVisible(baseStyles[i] === style);
  }
}
layerSelect.addEventListener('change', onBaseLayerChange);
onBaseLayerChange();

// a normal select interaction to handle click
var select = new Select();
map.addInteraction(select);
var selectedFeatures = select.getFeatures();

// a DragBox interaction used to select features by drawing boxes
var dragBox = new DragBox({
  condition: platformModifierKeyOnly,
});

map.addInteraction(dragBox);

// clear selection when drawing a new box and when clicking on the map
//dragBox.on('boxstart', function () {
//  selectedFeatures.clear();
//});

dragBox.on('boxend', function () {
  // features that intersect the box geometry are added to the
  // collection of selected features

  // if the view is not obliquely rotated the box geometry and
  // its extent are equalivalent so intersecting features can
  // be added directly to the collection
  var rotation = map.getView().getRotation();
  var oblique = rotation % (Math.PI / 2) !== 0;
  var candidateFeatures = oblique ? [] : selectedFeatures;
  var extent = dragBox.getGeometry().getExtent();

  map.getLayers().forEach((layer, index, array) => {
    if (layer instanceof VectorLayer && layer.getVisible()) {
      layer.getSource().forEachFeatureIntersectingExtent(extent, function (feature) {
        candidateFeatures.push(feature);
      });
    }
  });

  // when the view is obliquely rotated the box extent will
  // exceed its geometry so both the box and the candidate
  // feature geometries are rotated around a common anchor
  // to confirm that, with the box geometry aligned with its
  // extent, the geometries intersect
  if (oblique) {
    var anchor = [0, 0];
    var geometry = dragBox.getGeometry().clone();
    geometry.rotate(-rotation, anchor);
    var extent$1 = geometry.getExtent();
    candidateFeatures.forEach(function (feature) {
      var geometry = feature.getGeometry().clone();
      geometry.rotate(-rotation, anchor);
      if (geometry.intersectsExtent(extent$1)) {
        selectedFeatures.push(feature);
      }
    });
  }
});

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Fancy date formatting
// d is a Date object
// showDay is a boolean that controls whether or not the Day of Week is included
// output is a string
function niceDate(d, showDay) {
  return "" + d.getFullYear() + " " + months[d.getMonth()] + " " + d.getDate() +
     (showDay ? " (" + days[d.getDay()] + ") " : " ") +
     ((d.getHours() > 12) ? d.getHours() - 12 : d.getHours()) + ":" +
     (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() +
     ((d.getHours() > 11) ? " pm" : " am");
}

function niceType(t) {
  if (t === "Running") return "Run";
  else if (t === "Walking") return "Walk";
  else if (t === "Cycling") return "Bike";
  else if (t === "Hiking") return "Hike";
  else if (t === "Rowing") return "Row";
  else return "Unknown";
}

// Display info about a list of activities in the "info" area
// acts: a list of activity ids
function showActivities(acts, showDoW) {
  let info = [];
  let miles = 0.0;
  let hours = 0, minutes = 0, seconds = 0;

  if (acts.length > 0) {
    for (let i = 0; i < acts.length; i++) {
      let aid = acts[i];

      let actStr = niceDate(actDict[aid].date, showDoW) + " " + actDict[aid].type + " " +
                   actDict[aid].distance + " mi " +
                   "Dur: " + actDict[aid].duration + " " + "Pace: " + actDict[aid].avepace;
      miles += parseFloat(actDict[aid].distance);
      let times = actDict[aid].duration.split(':');
      if (times.length == 3) {
        seconds += parseInt(times[0]) * 60 * 60;
        times = times.slice(1);
      }
      if (times.length == 2) {
        seconds += parseInt(times[0]) * 60;
        times = times.slice(1);
      }
      if (times.length == 1)
        seconds += parseInt(times[0]);
      info.push(actStr);
    }

    hours = Math.floor(seconds / 3600);
    if (hours > 0)
      seconds = seconds - (hours * 3600);

    minutes = Math.floor(seconds / 60);
    if (minutes > 0)
      seconds = seconds - (minutes * 60);

    if (acts.length > 1)
      info.push(acts.length + " activities, " + miles.toFixed(2) + " miles, " + hours + " hours " + minutes + " minutes " + seconds + " seconds");

    infoBox.innerHTML = info.join('<br>') || '(unknown)';
  }
}

function showSelectedFeatureInfo() {
  var acts = selectedFeatures.getArray().map(function (feature) {
    return feature.get('actid');
  });

  if (acts.length > 0) {
    showActivities(acts, true);
  } else {
    infoBox.innerHTML = 'No activities selected';
  }
}

selectedFeatures.on(['add'], function (event) {
  let added = event.element.get('actid');
  let layer = actDict[added].layer;
  layer.setZIndex(10);     // bring feature layer to the front
  layer.setVisible(true);  // and make it visible (in case it was not)

  // make sure activity is highlighted in activity list
  var htmlElem = document.getElementById(added);
  htmlElem.style.background = "coral";

  // Scroll the activity list to the newly added activity
  htmlElem.scrollIntoView({
    block: "center",
    behavior: "smooth",
  });

  showSelectedFeatureInfo();
});

selectedFeatures.on(['remove'], function (event) {
  let removed = event.element.get('actid');
  let layer = actDict[removed].layer;
  layer.setZIndex(0);   // return feature layer Z to "normal"

  // make sure activity is no longer highlighted in activity list
  var htmlElem = document.getElementById(removed);
  htmlElem.style.background = "transparent";

  showSelectedFeatureInfo();
});

var firstAct = null;

// Handle when any activity on the right column (activity list) is clicked.
// The list element (e) has its id field set to the activity-id
// which is the key in the actDict dictionary
function activityListToggle(e) {
  let aid = this.id;

  let alreadySelected = false;
  let f = null;
  selectedFeatures.forEach((feature) => {
    if (feature.get('actid') == aid) {
      alreadySelected = true;
      f = feature;
    }
  });

  let layer = actDict[aid].layer;

  if (alreadySelected) {
    selectedFeatures.remove(f);
  } else {
    let features = layer.getSource().getFeatures();
    map.getView().fit(layer.getSource().getExtent());
    if (features.length > 0)
      selectedFeatures.push(features[0]);
  }
}

csv(require('../data/csv/cardioActivities.csv'), function(error, data) {
  if (error) throw error;

  var alist = "<ul class=\"top\">";

  //for (let i = 0; i < 70; i++) {   // temp speed up for development
  for (let i = 0; i < data.length; i++) {
    if (data[i]["GPX File"]) {
      var fileName = data[i]["Date"].replace(" ", "-").replace(/\:/g,"");

      if (allgpx[fileName]) {
        var vectorSource = new VectorSource({
          format: new GPX({
            url: allgpx[fileName],
            featureProjection: 'EPSG:3857'
          }),
          url: allgpx[fileName]
        });
        vectorSource.set('actid', data[i]["Activity Id"]);

        if (!firstAct)
          firstAct = data[i]["Activity Id"];

        // The layers (and thus their features) are loaded asynchronously
        // This is called when VectorSource actually completes loading
        // the GPX data, so we now have the feature (which contains the
        // geometry) created.
        vectorSource.on('addfeature', function(e) {
          let aid = this.get('actid');
          e.feature.set('actid', aid);

          // position the map based on the most recent activity
          // (which is assumed to be the first one in the csv file)
          if (aid == firstAct)
            map.getView().fit(this.getExtent());
        });

        let layer = new VectorLayer({
          source: vectorSource,
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
      nodeList[i].onclick = activityListToggle;
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
          layer.setVisible(showRunsBox.checked);
        else if (name.startsWith('Cycling'))
          layer.setVisible(showCyclingBox.checked);
        else if (name.startsWith('Walk'))
          layer.setVisible(showWalksBox.checked);
        else
          layer.setVisible(showOthersBox.checked);
      }
    }
  });
}

function setAllLayers(vis) {
  showRunsBox.checked = showWalksBox.checked = showCyclingBox.checked = showOthersBox.checked = vis;
  doToggle();
}

showRunsBox.addEventListener('change', doToggle);
showWalksBox.addEventListener('change', doToggle);
showCyclingBox.addEventListener('change', doToggle);
showOthersBox.addEventListener('change', doToggle);
document.getElementById('hide-all').onclick = function() { setAllLayers(false); };
document.getElementById('show-all').onclick = function() { setAllLayers(true); };

function displayFeatureInfo(pixel) {
  var acts = [];
  map.forEachFeatureAtPixel(pixel, function(feature) {
    if (feature.get('actid'))
      acts.push(feature.get('actid'));
  });

  if (acts.length > 0) {
    let aid = acts[0];
    let actStr = niceDate(actDict[aid].date, false) + " " + actDict[aid].type + " " +
      actDict[aid].distance + " mi " +
      "Dur: " + actDict[aid].duration + " " + "Pace: " + actDict[aid].avepace;
    mInfoBox.innerHTML = actStr;
  } else {
    mInfoBox.innerHTML = '&nbsp;';
  }
};

map.on('pointermove', function(evt) {
  if (evt.dragging) {
    return;
  }
  displayFeatureInfo(map.getEventPixel(evt.originalEvent));
});
