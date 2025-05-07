const map = L.map('map').setView([51.480, -2.591], 11);

const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB, © Crown copyright and database rights 2025 OS 0100059651, Contains OS data © Crown copyright [and database right] 2025.'
}).addTo(map);

let lsoaLookup = {};
const ladCodesString = ladCodes.map(code => `'${code}'`).join(',');

function convertMultiPolygonToPolygons(geoJson) {
  // console.log('Converting MultiPolygon to Polygon...');
  const features = [];
  const featureCounts = {};
  
  geoJson.features.forEach(feature => {
    const name = feature.properties.LAD24NM || feature.properties.WD24NM || feature.properties.LSOA21NM || feature.properties.name || 'Unknown';
    featureCounts[name] = (featureCounts[name] || 0) + 1;
    
    if (feature.geometry.type === 'MultiPolygon') {      
      const parts = feature.geometry.coordinates.map((polygonCoords, index) => {
        const area = turf.area(turf.polygon(polygonCoords));
        return { index, area, coords: polygonCoords };
      });
      
      parts.sort((a, b) => b.area - a.area);
            
      if (name === 'North Somerset' || name === 'South Gloucestershire' || 
          (feature.properties.name && feature.properties.name.length > 0)) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: parts[0].coords
          },
          properties: feature.properties
        });
      } else {
        feature.geometry.coordinates.forEach(polygonCoords => {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: polygonCoords
            },
            properties: feature.properties
          });
        });
      }
    } else {
      features.push(feature);
    }
  });
    
  return {
    type: 'FeatureCollection',
    features: features
  };
}

fetch(`https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_December_2024_Boundaries_UK_BGC/FeatureServer/0/query?outFields=*&where=LAD24CD%20IN%20(${ladCodesString})&f=geojson`)
  .then(response => response.json())
  .then(data => {
    const convertedData = convertMultiPolygonToPolygons(data);
    uaBoundariesLayer = convertedData;
    uaBoundariesLayer = L.geoJSON(convertedData, {
      pane: 'boundaryLayers',
      style: function (feature) {
        return {
          color: 'black',
          weight: 1.5,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
    updateFilterValues();
  });

fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Wards_December_2024_Boundaries_UK_BGC/FeatureServer/0/query?outFields=*&where=1%3D1&geometry=-3.073689%2C51.291726%2C-2.327195%2C51.656841&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson')
  .then(response => response.json())
  .then(data => {
    const convertedData = convertMultiPolygonToPolygons(data);
    const filteredFeatures = convertedData.features.filter(feature => ladCodes.includes(feature.properties.LAD24CD));
    const wardGeoJson = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    wardBoundariesLayer = L.geoJSON(wardGeoJson, {
      pane: 'boundaryLayers',
      style: function () {
        return {
          color: 'black',
          weight: 1,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LSOA21_WD24_LAD24_EW_LU/FeatureServer/0/query?outFields=*&where=LAD24CD%20IN%20(%27E06000022%27,%27E06000023%27,%27E06000024%27,%27E06000025%27)&f=geojson')
  .then(response => response.json())
  .then(data => {
    data.features.forEach(feature => {
      const lsoaCode = feature.properties.LSOA21CD;
      lsoaLookup[lsoaCode] = true;
    });

    return fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5/FeatureServer/0/query?outFields=*&where=1%3D1&geometry=-3.073689%2C51.291726%2C-2.327195%2C51.656841&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson');
  })
  .then(response => response.json())
  .then(data => {
    const convertedData = convertMultiPolygonToPolygons(data);
    const filteredFeatures = convertedData.features.filter(feature => lsoaLookup[feature.properties.LSOA21CD]);
    const lsoaGeoJson = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    lsoaBoundariesLayer = L.geoJSON(lsoaGeoJson, {
      pane: 'boundaryLayers',
      style: function () {
        return {
          color: 'black',
          weight: 0.6,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

const layers = {};
const AmenitiesPurpose = document.querySelectorAll('.checkbox-label input[type="checkbox"]');
const AmenitiesOpacity = document.getElementById("opacityFieldAmenitiesDropdown");
const AmenitiesOutline = document.getElementById("outlineFieldAmenitiesDropdown");
const AmenitiesOpacityRange = document.getElementById('opacityRangeAmenitiesSlider');
const AmenitiesOutlineRange = document.getElementById('outlineRangeAmenitiesSlider');
const AmenitiesInverseOpacity = document.getElementById("inverseOpacityScaleAmenitiesButton");
const AmenitiesInverseOutline = document.getElementById("inverseOutlineScaleAmenitiesButton");

const amenityLayers = {};
const amenityIcons = {
  PriSch: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-school" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  SecSch: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-school" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  FurEd: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-university" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Em500: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Em5000: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  StrEmp: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  CitCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-city" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  MajCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-shopping-bag" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  DisCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-store" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  GP: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-stethoscope" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Hos: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-hospital" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] })
};
const filterTypeDropdown = document.getElementById('filterTypeDropdown');
const filterValueDropdown = document.getElementById('filterValueDropdown');

Promise.all([
  fetch('https://AmFa6.github.io/TrainingCentres/grid-socioeco-lep_traccid_1of4.geojson').then(response => response.json()),
  fetch('https://AmFa6.github.io/TrainingCentres/grid-socioeco-lep_traccid_2of4.geojson').then(response => response.json()),
  fetch('https://AmFa6.github.io/TrainingCentres/grid-socioeco-lep_traccid_3of4.geojson').then(response => response.json()),
  fetch('https://AmFa6.github.io/TrainingCentres/grid-socioeco-lep_traccid_4of4.geojson').then(response => response.json())
])
.then(dataArray => {
  const combinedData = {
    type: 'FeatureCollection',
    features: []
  };
  
  dataArray.forEach(data => {
    if (data.features && Array.isArray(data.features)) {
      combinedData.features = combinedData.features.concat(data.features);
    }
  });
    
  grid = combinedData;
  
  if (initialLoadComplete) {
    updateSummaryStatistics(grid.features);
  }
})
.catch(error => {
  console.error("Error loading grid data:", error);
});

fetch('https://AmFa6.github.io/TAF_test/GrowthZones.geojson')
  .then(response => response.json())
  .then(data => {
    GrowthZonesLayer = L.geoJSON(data, {
      pane: 'boundaryLayers',
      style: function () {
        return {
          color: 'black',
          weight: 2,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

fetch(trainingCentresFile)
.then(response => response.json())
.then(data => {
  trainingCentresData = data;
  amenityLayers['trainingCentres'] = data;
  drawSelectedTrainingCentres();
});

fetch('https://AmFa6.github.io/TAF_test/lines.geojson')
  .then(response => response.json())
  .then(data => {
    busLinesLayer = L.geoJSON(data, {
      pane: 'busLayers',
      style: function (feature) {
        const frequency = parseFloat(feature.properties.am_peak_service_frequency) || 0;
        const opacity = frequency === 0 ? 0.1 : Math.min(0.1 + (frequency / 6) * 0.4, 0.5);
        
        return {
          color: 'green',
          weight: 2,
          fillOpacity: 0,
          opacity: 0,
          _calculatedOpacity: opacity
        };
      },
    }).addTo(map);
  });

fetch('https://AmFa6.github.io/TAF_test/stops.geojson')
  .then(response => response.json())
  .then(data => {
    busStopsLayer = L.geoJSON(data, {
      pane: 'busLayers',
      pointToLayer: function(feature, latlng) {
        const frequency = parseFloat(feature.properties.am_peak_combined_frequency) || 0;
        const fillOpacity = frequency === 0 ? 0 : Math.min(frequency / 12, 1);
        
        return L.circleMarker(latlng, {
          radius: 3,
          fillColor: 'green',
          color: 'green',
          weight: 0.5,
          opacity: 0,
          fillOpacity: 0,
          _calculatedFillOpacity: fillOpacity
        });
      }
    }).addTo(map);
  });

fetch('https://AmFa6.github.io/TAF_test/westlink.geojson')
  .then(response => response.json())
  .then(data => {
    const colors = [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', 
      '#ffff33', '#a65628', '#f781bf', '#999999', '#66c2a5',
      '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f'
    ];
    const convertedData = convertMultiPolygonToPolygons(data);
    WestLinkZonesLayer = L.geoJSON(convertedData, {
      pane: 'boundaryLayers',
      style: function (feature, layer) {
        const featureIndex = convertedData.features.findIndex(f => 
          f.properties.name === feature.properties.name
        );
        const colorIndex = featureIndex % colors.length;
        return {
          color: colors[colorIndex],
          weight: 3,
          fillColor: 'black',
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

fetch('https://AmFa6.github.io/TAF_test/simplified_network.geojson')
  .then(response => response.json())
  .then(data => {
    roadNetworkLayer = L.geoJSON(data, {
      pane: 'roadLayers',
      style: function (feature) {
        const roadFunction = feature.properties.roadfunction;
        let weight = 1;
        
        if (roadFunction === 'Motorway') {
          weight = 4;
        } else if (roadFunction === 'A Road') {
          weight = 2;
        }
        
        return {
          color: 'white',
          weight: weight,
          opacity: 0,
        };
      },
    }).addTo(map);
  });

AmenitiesOpacity.value = "None";
AmenitiesOutline.value = "None";

let trainingCentresData = null;
let opacityAmenitiesOrder = 'low-to-high';
let outlineAmenitiesOrder = 'low-to-high';
let isInverseAmenitiesOpacity = false;
let isInverseAmenitiesOutline = false;
let GrowthZonesLayer;
let uaBoundariesLayer;
let wardBoundariesLayer;
let lsoaBoundariesLayer;
let AmenitiesCatchmentLayer = null;
let gridTimeMap = {};
let csvDataCache = {};
let amenitiesLayerGroup = L.featureGroup();
let selectedAmenitiesAmenities = [];
let selectingFromMap = false;
let selectedAmenitiesFromMap = [];
let grid;
let highlightLayer = null;
let initialLoadComplete = false;
let isUpdatingSliders = false;
let wasAboveZoomThreshold = false;
let gridLayer = null;
let busLinesLayer;
let busStopsLayer;
let roadNetworkLayer;
let WestLinkZonesLayer;
let isUpdatingStyles = false;
let isCalculatingStats = false;
let isUpdatingVisibility = false;
let isUpdatingFilters = false;
let isUpdatingFilterValues = false;
let activeShapeMode = null; 
let activeActionMode = null;
let originalLayerState = null;
let hasUnsavedChanges = false;
let currentFeatureAttributes = {};
let pendingFeature = null;
let defaultAttributes = { "Name": "" };
let previousFilterSelections = {
  LA: null,
  Ward: null,
  GrowthZone: null,
  WestLinkZone: null,
  Range: null,
};

initializeSliders(AmenitiesOpacityRange);
initializeSliders(AmenitiesOutlineRange);

AmenitiesPurpose.forEach(checkbox => {
  checkbox.addEventListener("change", () => {
    if (!checkbox.checked && selectingFromMap) {
      const selectedAmenityType = checkbox.value;
      if (selectedAmenitiesAmenities.includes(selectedAmenityType) && 
          selectedAmenitiesAmenities.length === 1) {
        selectingFromMap = false;
        selectedAmenitiesFromMap = [];
        const amenitiesDropdown = document.getElementById('amenitiesDropdown');
        if (amenitiesDropdown) {
          const amenitiesCheckboxes = document.getElementById('amenitiesCheckboxesContainer')
            .querySelectorAll('input[type="checkbox"]');
          const selectedCheckboxes = Array.from(amenitiesCheckboxes).filter(cb => cb.checked);
          if (selectedCheckboxes.length === 0) {
            amenitiesDropdown.textContent = '\u00A0';
          } else if (selectedCheckboxes.length === 1) {
            amenitiesDropdown.textContent = selectedCheckboxes[0].nextElementSibling.textContent;
          } else {
            amenitiesDropdown.textContent = 'Multiple Selection';
          }
        }
      }
    }
    updateAmenitiesCatchmentLayer();
  });
});

AmenitiesOpacity.addEventListener("change", () => {
  updateSliderRanges('Amenities', 'Opacity');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});
AmenitiesOutline.addEventListener("change", () => {
  updateSliderRanges('Amenities', 'Outline');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});
AmenitiesInverseOpacity.addEventListener("click", () => {
  toggleInverseScale('Amenities', 'Opacity');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});
AmenitiesInverseOutline.addEventListener("click", () => {
  toggleInverseScale('Amenities', 'Outline');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});

filterTypeDropdown.addEventListener('change', () => {
  updateFilterValues();
  updateSummaryStatistics(getCurrentFeatures());
  
  const highlightCheckbox = document.getElementById('highlightAreaCheckbox');
  if (filterTypeDropdown.value === 'Range') {
    highlightCheckbox.disabled = true;
    highlightCheckbox.checked = false;
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
  } else {
    highlightCheckbox.disabled = false;
  }
  
  if (document.getElementById('highlightAreaCheckbox').checked) {
    highlightSelectedArea();
  }
});
filterValueDropdown.addEventListener('change', () => {
  updateSummaryStatistics(getCurrentFeatures());
  if (document.getElementById('highlightAreaCheckbox').checked) {
    highlightSelectedArea();
  }
});
document.getElementById('highlightAreaCheckbox').addEventListener('change', function() {
  if (this.checked) {
    highlightSelectedArea();
  } else {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
  }
});

document.addEventListener('DOMContentLoaded', (event) => {
  const collapsibleButtons = document.querySelectorAll(".collapsible");
  collapsibleButtons.forEach(button => {
    const content = button.nextElementSibling;
    if (content) {
      content.style.display = "none";
      button.classList.add("collapsed");

      button.addEventListener("click", function() {
        this.classList.toggle("active");
        content.style.display = content.style.display === "block" ? "none" : "block";
        this.classList.toggle("collapsed", content.style.display === "none");
      });
    }
  });

  let lastAmenitiesState = {
    selectingFromMap: false,
    selectedAmenitiesFromMap: [],
    selectedAmenitiesAmenities: []
  };

  function handlePanelStateChange(header, isOpen) {
    const dataPanelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
    
    if (isOpen) {
      dataPanelHeaders.forEach(otherHeader => {
        if (otherHeader !== header) {
          otherHeader.classList.add("collapsed");
          const otherContent = otherHeader.nextElementSibling;
          if (otherContent) {
            otherContent.style.display = "none";
          }
          
          if (otherHeader.textContent.includes("Journey Time Catchments - Training Centres") && AmenitiesCatchmentLayer) {
            lastAmenitiesState = {
              selectingFromMap,
              selectedAmenitiesFromMap,
              selectedAmenitiesAmenities
            };
            map.removeLayer(AmenitiesCatchmentLayer);
            AmenitiesCatchmentLayer = null;
          }
        }
      });
    }
    
    requestAnimationFrame(() => {
      if (isOpen) {
        if (header.textContent.includes("Journey Time Catchments - Training Centres")) {
          if (lastAmenitiesState.selectingFromMap) {
            selectingFromMap = lastAmenitiesState.selectingFromMap;
            selectedAmenitiesFromMap = [...lastAmenitiesState.selectedAmenitiesFromMap];
            
            AmenitiesPurpose.forEach(checkbox => {
              checkbox.checked = lastAmenitiesState.selectedAmenitiesAmenities.includes(checkbox.value);
            });
            
            const amenitiesDropdown = document.getElementById('amenitiesDropdown');
            if (amenitiesDropdown && selectedAmenitiesFromMap.length > 0) {
              const amenityType = lastAmenitiesState.selectedAmenitiesAmenities[0];
              const typeLabel = getAmenityTypeDisplayName(amenityType);
              amenitiesDropdown.textContent = `${typeLabel} (ID: ${selectedAmenitiesFromMap.join(',')})`;
            }
          }
          updateAmenitiesCatchmentLayer();
        }
        
        requestAnimationFrame(() => {
          updateFilterDropdown();
          updateFilterValues();
        });
      } else {
        if (header.textContent.includes("Journey Time Catchments - Training Centres") && AmenitiesCatchmentLayer) {
          lastAmenitiesState = {
            selectingFromMap,
            selectedAmenitiesFromMap,
            selectedAmenitiesAmenities
          };
          map.removeLayer(AmenitiesCatchmentLayer);
          AmenitiesCatchmentLayer = null;
          drawSelectedTrainingCentres([]);
        }
        
        requestAnimationFrame(() => {
          updateFilterDropdown();
          updateFilterValues();
        });
      }
    });
  }

  const panelHeaders = document.querySelectorAll(".panel-header");
  panelHeaders.forEach(header => {
    const content = header.nextElementSibling;
    if (content) {
      content.style.display = "none";
      header.classList.add("collapsed");

      header.addEventListener("click", function() {
        const isCurrentlyOpen = !this.classList.contains('collapsed');
        const willOpen = !isCurrentlyOpen;
        
        this.classList.toggle("collapsed");
        content.style.display = willOpen ? "block" : "none";
        
        if (!this.classList.contains('summary-header')) {
          handlePanelStateChange(this, willOpen);
        }
      });
    }
  });

  const summaryHeader = document.getElementById('toggle-summary-panel');
  const summaryContent = document.getElementById('summary-content');
  
  if (summaryHeader && summaryContent) {
    summaryContent.style.display = "none";
    summaryHeader.classList.add("collapsed");
    
    summaryHeader.addEventListener("click", function() {
      const isCollapsed = this.classList.contains("collapsed");
      this.classList.toggle("collapsed");
      summaryContent.style.display = isCollapsed ? "block" : "none";
    });
    
    summaryHeader.addEventListener("click", function() {
      this.classList.toggle("collapsed");
      const isNowCollapsed = this.classList.contains("collapsed");
      summaryContent.style.display = isNowCollapsed ? "none" : "block";
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    const yearDropdown = document.getElementById('yearDropdown');
    const yearContainer = document.getElementById('yearContainer');
    const yearRadios = yearContainer.querySelectorAll('input[type="radio"]');
    const subjectDropdown = document.getElementById('subjectDropdown');
    const subjectCheckboxesContainer = document.getElementById('subjectCheckboxesContainer');
    const subjectCheckboxes = subjectCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
  
    const aimLevelDropdown = document.getElementById('aimlevelDropdown');
    const aimLevelCheckboxesContainer = document.getElementById('aimlevelCheckboxesContainer');
    const aimLevelCheckboxes = aimLevelCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
    
    yearDropdown.addEventListener('click', () => {
      yearContainer.classList.toggle('show');
    });
    yearRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        updateYearDropdownLabel();
        drawSelectedTrainingCentres();
        updateAmenitiesCatchmentLayer();
      });
    });

    subjectDropdown.addEventListener('click', () => {
      subjectCheckboxesContainer.classList.toggle('show');
    });
    subjectCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        updateSubjectDropdownLabel();
        drawSelectedTrainingCentres();
        updateAmenitiesCatchmentLayer();
      });
    });
    
    aimLevelDropdown.addEventListener('click', () => {
      aimLevelCheckboxesContainer.classList.toggle('show');
    });
    aimLevelCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        updateAimLevelDropdownLabel();
        drawSelectedTrainingCentres();
        updateAmenitiesCatchmentLayer();
      });
    });
    
    updateYearDropdownLabel();
    updateSubjectDropdownLabel();
    updateAimLevelDropdownLabel();
    
    window.addEventListener('click', (event) => {
      if (!event.target.matches('#subjectDropdown')) {
        subjectCheckboxesContainer.classList.remove('show');
      }
      if (!event.target.matches('#aimlevelDropdown')) {
        aimLevelCheckboxesContainer.classList.remove('show');
      }
      if (!event.target.matches('#yearDropdown')) {
        yearContainer.classList.remove('show');
      }
    });
  });

  document.querySelectorAll('.legend-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateFeatureVisibility);
  });
  
  function createStaticLegendControls() {
    const amenitiesCheckbox = document.getElementById('amenitiesCheckbox');
    if (amenitiesCheckbox) {
      amenitiesCheckbox.addEventListener('change', () => {
        if (amenitiesCheckbox.checked) {
          amenitiesLayerGroup.addTo(map);
        } else {
          map.removeLayer(amenitiesLayerGroup);
        }
      });
    }

    const uaBoundariesCheckbox = document.getElementById('uaBoundariesCheckbox');
    if (uaBoundariesCheckbox) {
      uaBoundariesCheckbox.addEventListener('change', () => {
        if (uaBoundariesCheckbox.checked) {
          uaBoundariesLayer.setStyle({ opacity: 1 });
        } else {
          uaBoundariesLayer.setStyle({ opacity: 0 });
        }
      });
    }

    const wardBoundariesCheckbox = document.getElementById('wardBoundariesCheckbox');
    if (wardBoundariesCheckbox) {
      wardBoundariesCheckbox.addEventListener('change', () => {
        if (wardBoundariesCheckbox.checked) {
          wardBoundariesLayer.setStyle({ opacity: 1 });
        } else {
          wardBoundariesLayer.setStyle({ opacity: 0 });
        }
      });
    }
    
    const lsoaCheckbox = document.getElementById('lsoaCheckbox');
    if (lsoaCheckbox) {
      lsoaCheckbox.addEventListener('change', () => {
        if (lsoaCheckbox.checked) {
          lsoaBoundariesLayer.setStyle({ opacity: 1 });
        } else {
          lsoaBoundariesLayer.setStyle({ opacity: 0 });
        }
      });
    }
    
    const GrowthZonesCheckbox = document.getElementById('GrowthZonesCheckbox');
    if (GrowthZonesCheckbox) {
      GrowthZonesCheckbox.addEventListener('change', () => {
        if (GrowthZonesCheckbox.checked) {
          GrowthZonesLayer.setStyle({ opacity: 1 });
        } else {
          GrowthZonesLayer.setStyle({ opacity: 0 });
        }
      });
    }
    
    const busStopsCheckbox = document.getElementById('busStopsCheckbox');
    if (busStopsCheckbox) {
      busStopsCheckbox.addEventListener('change', () => {
        if (busStopsCheckbox.checked) {
          busStopsLayer.eachLayer(layer => {
            layer.setStyle({ 
              opacity: 1, 
              fillOpacity: layer.options._calculatedFillOpacity 
            });
          });
        } else {
          busStopsLayer.eachLayer(layer => {
            layer.setStyle({ opacity: 0, fillOpacity: 0 });
          });
        }
      });
    }
    
    const busLinesCheckbox = document.getElementById('busLinesCheckbox');
    if (busLinesCheckbox) {
      busLinesCheckbox.addEventListener('change', () => {
        if (busLinesCheckbox.checked) {
          busLinesLayer.eachLayer(layer => {
            layer.setStyle({ opacity: layer.options._calculatedOpacity });
          });
        } else {
          busLinesLayer.setStyle({ opacity: 0 });
        }
      });
    }

    const WestLinkZonesCheckbox = document.getElementById('WestLinkZonesCheckbox');
    if (WestLinkZonesCheckbox) {
      WestLinkZonesCheckbox.addEventListener('change', () => {
        if (WestLinkZonesCheckbox.checked) {
          WestLinkZonesLayer.setStyle({
            opacity: 1,
          });
        } else {
          WestLinkZonesLayer.setStyle({
            opacity: 0,
          });
        }
      });
    }
    const roadNetworkCheckbox = document.getElementById('roadNetworkCheckbox');
      if (roadNetworkCheckbox) {
        roadNetworkCheckbox.addEventListener('change', () => {
          if (roadNetworkCheckbox.checked) {
            roadNetworkLayer.setStyle({
                opacity: 1,
              });
          } else {
            roadNetworkLayer.setStyle({
              opacity: 0,
            });
          }
        });
      }
  }
  createStaticLegendControls();

  function initializeLegendControls() {
    document.querySelectorAll('.legend-category-header').forEach(header => {
      header.addEventListener('click', function() {
        const category = this.closest('.legend-category');
        category.classList.toggle('legend-category-collapsed');
      });
    });
    
    const legendHeader = document.querySelector('.legend-header');
    let isLegendExpanded = true;
    
    legendHeader.addEventListener('click', function() {
      isLegendExpanded = !isLegendExpanded;
      
      const legend = document.getElementById('legend');
      legend.classList.toggle('collapsed', !isLegendExpanded);
      
      const legendContent = document.getElementById('legend-content-wrapper');
      if (legendContent) {
        legendContent.style.display = isLegendExpanded ? 'block' : 'none';
      }
    });
  }
  
  initializeLegendControls();

  const dataLayerCategory = document.getElementById('data-layer-category');
  if (dataLayerCategory) {
    dataLayerCategory.style.display = 'none';
  }

  updateFilterDropdown();
  updateFilterValues();

  initialLoadComplete = true;

  function setupMapPanes() {
    const existingPanes = document.querySelectorAll('.leaflet-pane[style*="z-index"]');
    existingPanes.forEach(pane => {
      if (pane.className.includes('custom-pane')) {
        pane.parentNode.removeChild(pane);
      }
    });
    
    map.createPane('polygonLayers').style.zIndex = 300;
    map.createPane('boundaryLayers').style.zIndex = 400;
    map.createPane('roadLayers').style.zIndex = 500;
    map.createPane('busLayers').style.zIndex = 600;
  }
  
  setupMapPanes();
});

map.on('zoomend', () => {
  const currentZoom = map.getZoom();
  const isAboveZoomThreshold = currentZoom >= 14;
  
  if (isAboveZoomThreshold !== wasAboveZoomThreshold) {
    wasAboveZoomThreshold = isAboveZoomThreshold;
    
    if (AmenitiesCatchmentLayer) {
      drawSelectedTrainingCentres(selectedAmenitiesAmenities);
    } else {
      drawSelectedTrainingCentres([]);
    }
  }
});

map.on('click', function (e) {
  if (isDrawingActive) {
    return;
  }
  const clickedLatLng = e.latlng;
  const clickedPoint = turf.point([clickedLatLng.lng, clickedLatLng.lat]);
  
  const busStopsVisible = document.getElementById('busStopsCheckbox')?.checked;
  const busLinesVisible = document.getElementById('busLinesCheckbox')?.checked;
  
  if (busStopsVisible || busLinesVisible) {
    const nearbyFeatures = findNearbyInfrastructure(clickedLatLng);
    
    if (!busStopsVisible) nearbyFeatures.busStops = [];
    if (!busLinesVisible) nearbyFeatures.busLines = [];
    
    const hasNearbyFeatures = 
      nearbyFeatures.busStops.length > 0 || 
      nearbyFeatures.busLines.length > 0;
    
    if (hasNearbyFeatures) {
      showInfrastructurePopup(clickedLatLng, nearbyFeatures);
      return;
    }
  }
  
  const popupContent = {
    Geographies: [],
    gridCell: []
  };

  let isWithinLEP = false;
  if (uaBoundariesLayer) {
    uaBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        isWithinLEP = true;
        popupContent.Geographies.push(`<strong>Local Authority:</strong> ${layer.feature.properties.LAD24NM}`);
      }
    });
  }

  if (!isWithinLEP) {
    return;
  }

  if (wardBoundariesLayer) {
    wardBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>Ward:</strong> ${layer.feature.properties.WD24NM}`);
      }
    });
  }

  if (lsoaBoundariesLayer) {
    lsoaBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>LSOA:</strong> ${layer.feature.properties.LSOA21NM}`);
      }
    });
  }

  if (GrowthZonesLayer) {
    GrowthZonesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>Growth Zone:</strong> ${layer.feature.properties.Name}`);
      }
    });
  }

  if (WestLinkZonesLayer) {
    WestLinkZonesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>WESTlink Zone:</strong> ${layer.feature.properties.name}`);
      }
    });
  }

  if (AmenitiesCatchmentLayer) {
    const gridLayer = AmenitiesCatchmentLayer;
    gridLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        const properties = layer.feature.properties;
        if (AmenitiesCatchmentLayer) {
          const time = formatValue(gridTimeMap[properties.COREID], 1);
          const population = formatValue(properties.pop, 10);
          const imdScore = formatValue(properties.IMDScore, 0.1);
          const imdDecile = formatValue(properties.IMD_Decile, 1);
          const carAvailability = formatValue(properties.car_availability, 0.01);
          const growthPop = formatValue(properties.pop_growth, 10);

          popupContent.gridCell.push(`
            <strong>COREID:</strong> ${properties.COREID}<br>
            <strong>Journey Time:</strong> ${time} minutes<br>
            <strong>Population:</strong> ${population}<br>
            <strong>IMD Score:</strong> ${imdScore}<br>
            <strong>IMD Decile:</strong> ${imdDecile}<br>
            <strong>Car Availability:</strong> ${carAvailability}<br>
            <strong>Population Growth:</strong> ${growthPop}
          `);
        }
      }
    });
  } else if (grid) {
    grid.features.forEach(feature => {
      const polygon = turf.polygon(feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        const properties = feature.properties;
        const population = formatValue(properties.pop, 10);
        const imdScore = formatValue(properties.IMDScore, 0.1);
        const imdDecile = formatValue(properties.IMD_Decile, 1);
        const carAvailability = formatValue(properties.car_availability, 0.01);
        const growthPop = formatValue(properties.pop_growth, 10);

        popupContent.gridCell.push(`
          <strong>COREID:</strong> ${properties.COREID}<br>
          <strong>Population:</strong> ${population}<br>
          <strong>IMD Score:</strong> ${imdScore}<br>
          <strong>IMD Decile:</strong> ${imdDecile}<br>
          <strong>Car Availability:</strong> ${carAvailability}<br>
          <strong>Population Growth:</strong> ${growthPop}
        `);
      }
    });
  }

  const content = `
    <div>
      <h4 style="text-decoration: underline;">Geographies</h4>
      ${popupContent.Geographies.length > 0 ? popupContent.Geographies.join('<br>') : '-'}
      <h4 style="text-decoration: underline;">gridCell</h4>
      ${popupContent.gridCell.length > 0 ? popupContent.gridCell.join('<br>') : '-'}
    </div>
  `;

  L.popup()
    .setLatLng(clickedLatLng)
    .setContent(content)
    .openOn(map);
});

function isPanelOpen(panelName) {
  // console.log('Checking if panel is open...');
  const panelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
  for (const header of panelHeaders) {
    if (header.textContent.includes(panelName) && !header.classList.contains("collapsed")) {
      return true;
    }
  }
  return false;
}

function configureSlider(sliderElement, isInverse) {
  if (sliderElement.noUiSlider) {
    sliderElement.noUiSlider.off('update');
  }
  
  updateLayerStyles()

  const handles = sliderElement.querySelectorAll('.noUi-handle');
  const connectElements = sliderElement.querySelectorAll('.noUi-connect');

  if (handles.length >= 2) {
    handles[0].classList.add('noUi-handle-lower');
    handles[1].classList.add('noUi-handle-upper');
  }
  
  handles.forEach(handle => {
    handle.classList.remove('noUi-handle-transparent');
  });
  
  connectElements.forEach(connect => {
    connect.classList.remove('noUi-connect-dark-grey', 'noUi-connect-gradient-right', 'noUi-connect-gradient-left');
  });

  if (isInverse) {
    sliderElement.noUiSlider.updateOptions({
      connect: [true, true, true]
    }, false);
    
    if (handles.length >= 2) {
      handles[1].classList.add('noUi-handle-transparent');
      handles[0].classList.remove('noUi-handle-transparent');
    }
    
    if (connectElements.length >= 3) {
      connectElements[0].classList.add('noUi-connect-dark-grey');
      connectElements[1].classList.add('noUi-connect-gradient-left');
      connectElements[2].classList.remove('noUi-connect-dark-grey');
    }
  } else {
    sliderElement.noUiSlider.updateOptions({
      connect: [true, true, true]
    }, false);
    
    if (handles.length >= 2) {
      handles[0].classList.add('noUi-handle-transparent');
      handles[1].classList.remove('noUi-handle-transparent');
    }
    
    if (connectElements.length >= 3) {
      connectElements[0].classList.remove('noUi-connect-dark-grey');
      connectElements[1].classList.add('noUi-connect-gradient-right');
      connectElements[2].classList.add('noUi-connect-dark-grey');
    }
  }

  sliderElement.noUiSlider.on('update', function (values, handle) {
    const handleElement = handles[handle];
    const step = sliderElement.noUiSlider.options.step;
    const formattedValue = formatValue(values[handle], step);
    handleElement.setAttribute('data-value', formattedValue);
    
    if (!isUpdatingStyles) {
      isUpdatingStyles = true;
      requestAnimationFrame(() => {
        updateLayerStyles();
        isUpdatingStyles = false;
      });
    }
  });
}

function updateSliderRanges(type, scaleType) {
  // console.log('Updating slider ranges...');
  if (isUpdatingSliders) return;
  isUpdatingSliders = true;

  let field, rangeElement, minElement, maxElement, gridData, order, isInverse;

  if (type === 'Amenities') {
    if (scaleType === 'Opacity') {
      field = AmenitiesOpacity.value;
      rangeElement = AmenitiesOpacityRange;
      minElement = document.getElementById('opacityRangeAmenitiesMin');
      maxElement = document.getElementById('opacityRangeAmenitiesMax');
      gridData = grid;
      order = opacityAmenitiesOrder;
      isInverse = isInverseAmenitiesOpacity;
    } else if (scaleType === 'Outline') {
      field = AmenitiesOutline.value;
      rangeElement = AmenitiesOutlineRange;
      minElement = document.getElementById('outlineRangeAmenitiesMin');
      maxElement = document.getElementById('outlineRangeAmenitiesMax');
      gridData = grid;
      order = outlineAmenitiesOrder;
      isInverse = isInverseAmenitiesOutline;
    }
  }

  if (!rangeElement || !rangeElement.noUiSlider) {
    isUpdatingSliders = false;
    return;
  }
  
  if (gridData) {
    const values = field !== "None" ? 
      gridData.features.map(feature => feature.properties[field]).filter(value => value !== null && value !== 0) : [];
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    const roundedMaxValue = Math.pow(10, Math.ceil(Math.log10(maxValue)));
    let step = roundedMaxValue / 100;

    if (isNaN(step) || step <= 0) {
      step = 1;
    }

    const adjustedMaxValue = Math.ceil(maxValue / step) * step;
    const adjustedMinValue = Math.floor(minValue / step) * step;
    
    if (field === "None") {
      rangeElement.setAttribute('disabled', true);
      rangeElement.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      }, false);
      rangeElement.noUiSlider.set(['', ''], false);
      minElement.innerText = '';
      maxElement.innerText = '';
    } else {
      rangeElement.removeAttribute('disabled');
      rangeElement.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinValue,
          'max': adjustedMaxValue
        },
        step: step
      }, false);
      rangeElement.noUiSlider.set([adjustedMinValue, adjustedMaxValue], false);
      minElement.innerText = formatValue(adjustedMinValue, step);
      maxElement.innerText = formatValue(adjustedMaxValue, step);
    }

    configureSlider(rangeElement, isInverse);   
  }

  isUpdatingSliders = false;

  if (type === 'Amenities' && AmenitiesCatchmentLayer) {
    applyAmenitiesCatchmentLayerStyling();
  }
}

function initializeSliders(sliderElement) {
  if (sliderElement.noUiSlider) {
    sliderElement.noUiSlider.destroy();
  }

  noUiSlider.create(sliderElement, {
    start: ['', ''],
    connect: [true, true, true],
    range: {
      'min': 0,
      'max': 0
    },
    step: 1,
    tooltips: false,
    format: {
      to: value => parseFloat(value),
      from: value => parseFloat(value)
    }
  });

  const handles = sliderElement.querySelectorAll('.noUi-handle');
  if (handles.length > 0) {
    handles[0].classList.add('noUi-handle-transparent');
  }

  const connectElements = sliderElement.querySelectorAll('.noUi-connect');
  if (connectElements.length > 2) {
    connectElements[1].classList.add('noUi-connect-gradient-right');
    connectElements[2].classList.add('noUi-connect-dark-grey');
  }

  configureSlider(sliderElement, false);
}

function toggleInverseScale(type, scaleType) {
  // console.log('Toggling inverse scale...');
  isUpdatingSliders = true;

  let isInverse, rangeElement, order;

  if (type === 'Amenities') {
    if (scaleType === 'Opacity') {
      isInverseAmenitiesOpacity = !isInverseAmenitiesOpacity;
      isInverse = isInverseAmenitiesOpacity;
      rangeElement = AmenitiesOpacityRange;
      opacityAmenitiesOrder = isInverse ? 'high-to-low' : 'low-to-high';
    } else if (scaleType === 'Outline') {
      isInverseAmenitiesOutline = !isInverseAmenitiesOutline;
      isInverse = isInverseAmenitiesOutline;
      rangeElement = AmenitiesOutlineRange;
      outlineAmenitiesOrder = isInverse ? 'high-to-low' : 'low-to-high';
    }
  }

  const currentValues = rangeElement.noUiSlider.get();
  
  configureSlider(rangeElement, isInverse);
  rangeElement.noUiSlider.set(currentValues, false);

  updateSliderRanges(type, scaleType);

  isUpdatingSliders = false;
}

function scaleExp(value, minVal, maxVal, minScale, maxScale, order) {
  if (value <= minVal) return order === 'low-to-high' ? minScale : maxScale;
  if (value >= maxVal) return order === 'low-to-high' ? maxScale : minScale;
  const normalizedValue = (value - minVal) / (maxVal - minVal);
  const scaledValue = order === 'low-to-high' ? normalizedValue : 1 - normalizedValue;
  return minScale + scaledValue * (maxScale - minScale);
}

function formatValue(value, step) {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  if (step >= 100) {
    return (Math.round(value / 100) * 100)
      .toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (step >= 10) {
    return (Math.round(value / 10) * 10)
      .toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (step >= 1) {
    return Math.round(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (step >= 0.1) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } else if (step >= 0.01) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return value.toString();
  }
}

function isClassVisible(value) {
  const legendCheckboxes = document.querySelectorAll('.legend-checkbox');
  for (const checkbox of legendCheckboxes) {
    const range = checkbox.getAttribute('data-range');
    const isChecked = checkbox.checked;

    if (range.includes('>') && range.includes('<=') && value > parseFloat(range.split('>')[1].split('<=')[0]) && value <= parseFloat(range.split('<=')[1]) && !isChecked) {
      return false;
    } else if (range.includes('>') && !range.includes('<=') && value > parseFloat(range.split('>')[1]) && !isChecked) {
      return false;
    } else if (range.includes('-')) {
      const [min, max] = range.split('-').map(parseFloat);
      if (value >= min && value <= max && !isChecked) {
        return false;
      }
    }
  }
  return true;
}

function updateFeatureVisibility() {
  if (isUpdatingVisibility) return;
  isUpdatingVisibility = true;

  const updateLayerVisibility = (layer, getValue, attribute) => {
    layer.eachLayer(layer => {
      const feature = layer.feature;
      const value = getValue(feature);
      const isVisible = isClassVisible(value);

      if (layer.options._originalStyling === undefined) {
        layer.options._originalStyling = {
          opacity: layer.options.opacity,
          fillOpacity: layer.options.fillOpacity
        };
      }

      if (isVisible) {
        layer.setStyle({ 
          opacity: layer.options._originalStyling.opacity, 
          fillOpacity: layer.options._originalStyling.fillOpacity 
        });
      } else {
        layer.setStyle({ opacity: 0, fillOpacity: 0 });
      }
    });
  };

  if (AmenitiesCatchmentLayer) {
    updateLayerVisibility(AmenitiesCatchmentLayer, feature => gridTimeMap[feature.properties.COREID], 'time');
  }
  
  isUpdatingVisibility = false;
}

function updateLegend() {
  // console.log('Updating legend...');
  const legendContent = document.getElementById("legend-content");
  
  const dataLayerCategory = document.getElementById('data-layer-category');
  if (!dataLayerCategory) return;
  
  if (!AmenitiesCatchmentLayer) {
    dataLayerCategory.style.display = 'none';
    return;
  } else {
    dataLayerCategory.style.display = '';
  }
  
  const legendCategoryHeader = dataLayerCategory.querySelector('.legend-category-header span');
  if (legendCategoryHeader) {
    if (AmenitiesCatchmentLayer) {
      legendCategoryHeader.textContent = "Journey Time Catchment (minutes)";
    }
  }
  
  const wasCollapsed = dataLayerCategory.classList.contains('legend-category-collapsed');
  
  const checkboxStates = {};
  const legendCheckboxes = document.querySelectorAll('.legend-checkbox');
  legendCheckboxes.forEach(checkbox => {
    checkboxStates[checkbox.getAttribute('data-range')] = checkbox.checked;
  });

  legendContent.innerHTML = '';

  let classes;

  if (AmenitiesCatchmentLayer) {
    classes = [
      { range: `> 0 and <= 5`, color: "#fde725" },
      { range: `> 5 and <= 10`, color: "#8fd744" },
      { range: `> 10 and <= 15`, color: "#35b779" },
      { range: `> 15 and <= 20`, color: "#21908d" },
      { range: `> 20 and <= 25`, color: "#31688e" },
      { range: `> 25 and <= 30`, color: "#443a82" },
      { range: `> 30`, color: "#440154" }
    ];
  }

  const masterCheckboxDiv = document.createElement("div");
  masterCheckboxDiv.innerHTML = `<input type="checkbox" id="masterCheckbox" checked> <i>Select/Deselect All</i>`;
  legendContent.appendChild(masterCheckboxDiv);

  classes.forEach(c => {
    const div = document.createElement("div");
    const isChecked = checkboxStates[c.range] !== undefined ? checkboxStates[c.range] : true;
    div.innerHTML = `<input type="checkbox" class="legend-checkbox" data-range="${c.range}" ${isChecked ? 'checked' : ''}> <span style="display: inline-block; width: 20px; height: 20px; background-color: ${c.color};"></span> ${c.range}`;
    legendContent.appendChild(div);
  });

  function updateMasterCheckbox() {
    const newLegendCheckboxes = document.querySelectorAll('.legend-checkbox');
    const allChecked = Array.from(newLegendCheckboxes).every(checkbox => checkbox.checked);
    const noneChecked = Array.from(newLegendCheckboxes).every(checkbox => !checkbox.checked);
    const masterCheckbox = document.getElementById('masterCheckbox');
    masterCheckbox.checked = allChecked;
    masterCheckbox.indeterminate = !allChecked && !noneChecked;
  }

  const newLegendCheckboxes = document.querySelectorAll('.legend-checkbox');
  newLegendCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateMasterCheckbox();
      updateFeatureVisibility();
    });
  });

  const masterCheckbox = document.getElementById('masterCheckbox');
  masterCheckbox.addEventListener('change', () => {
    const isChecked = masterCheckbox.checked;
    newLegendCheckboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
    });
    updateFeatureVisibility();
  });
  
  updateMasterCheckbox();
  
  if (!wasCollapsed && (AmenitiesCatchmentLayer)) {
    dataLayerCategory.classList.remove('legend-category-collapsed');
  }
}

function findNearbyInfrastructure(latlng, maxPixelDistance = 10) {
  // console.log('Finding nearby infrastructure...');
  const results = {
    busStops: [],
    busLines: []
  };
  
  if (busStopsLayer) {
    busStopsLayer.eachLayer(layer => {
      const markerPoint = map.latLngToContainerPoint(layer.getLatLng());
      const clickPoint = map.latLngToContainerPoint(latlng);
      const pixelDistance = clickPoint.distanceTo(markerPoint);
      
      if (pixelDistance <= maxPixelDistance) {
        results.busStops.push({
          layer: layer,
          feature: layer.feature,
          distance: pixelDistance
        });
      }
    });
  }
  
  if (busLinesLayer) {
    busLinesLayer.eachLayer(layer => {
      const geojson = layer.toGeoJSON();
      let minPixelDistance = Infinity;
      
      if (geojson.geometry.type === 'LineString') {
        for (let i = 0; i < geojson.geometry.coordinates.length - 1; i++) {
          const p1 = L.latLng(
            geojson.geometry.coordinates[i][1], 
            geojson.geometry.coordinates[i][0]
          );
          const p2 = L.latLng(
            geojson.geometry.coordinates[i+1][1], 
            geojson.geometry.coordinates[i+1][0]
          );
          
          const p1Screen = map.latLngToContainerPoint(p1);
          const p2Screen = map.latLngToContainerPoint(p2);
          
          const distance = distanceToLineSegment(
            map.latLngToContainerPoint(latlng), 
            p1Screen, 
            p2Screen
          );
          
          if (distance < minPixelDistance) {
            minPixelDistance = distance;
          }
        }
      }
      else if (geojson.geometry.type === 'MultiLineString') {
        for (const lineCoords of geojson.geometry.coordinates) {
          for (let i = 0; i < lineCoords.length - 1; i++) {
            const p1 = L.latLng(lineCoords[i][1], lineCoords[i][0]);
            const p2 = L.latLng(lineCoords[i+1][1], lineCoords[i+1][0]);
            
            const p1Screen = map.latLngToContainerPoint(p1);
            const p2Screen = map.latLngToContainerPoint(p2);
            
            const distance = distanceToLineSegment(
              map.latLngToContainerPoint(latlng),
              p1Screen,
              p2Screen
            );
            
            if (distance < minPixelDistance) {
              minPixelDistance = distance;
            }
          }
        }
      }
      
      if (minPixelDistance <= maxPixelDistance) {
        results.busLines.push({
          layer: layer,
          feature: layer.feature,
          distance: minPixelDistance
        });
      }
    });
  }
  
  function distanceToLineSegment(p, v, w) {
    const l2 = distanceSquared(v, w);
    
    if (l2 === 0) return Math.sqrt(distanceSquared(p, v));
    
    const t = Math.max(0, Math.min(1, 
      dotProduct(subtractPoints(p, v), subtractPoints(w, v)) / l2
    ));
    
    const projection = {
      x: v.x + t * (w.x - v.x),
      y: v.y + t * (w.y - v.y)
    };
    
    return Math.sqrt(distanceSquared(p, projection));
  }
  
  function distanceSquared(p1, p2) {
    return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
  }
  
  function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
  }
  
  function subtractPoints(p1, p2) {
    return { x: p1.x - p2.x, y: p1.y - p2.y };
  }
  
  results.busStops.sort((a, b) => {
    const nameA = a.feature.properties.stop_name || '';
    const nameB = b.feature.properties.stop_name || '';
    return nameA.localeCompare(nameB);
  });
  
  results.busLines.sort((a, b) => {
    const serviceA = a.feature.properties.service_name || '';
    const serviceB = b.feature.properties.service_name || '';
    return serviceA.localeCompare(serviceB);
  });
  
  return results;
}

function formatFeatureProperties(feature, featureType) {
  // console.log('Formatting feature properties...');
  if (!feature || !feature.properties) return '<p>No data available</p>';
  
  let html = '<table class="popup-table">';
  html += '<tr><th>Property</th><th>Value</th></tr>';
  
  if (featureType === 'Bus Stop') {
    const props = feature.properties;
    const attributes = [
      { key: 'atco_code', display: 'ATCO Code' },
      { key: 'stop_name', display: 'Stop Name' },
      { key: 'am_peak_combined_frequency', display: 'AM Peak Frequency' },
      { key: 'mode', display: 'Mode' }
    ];
    
    attributes.forEach(attr => {
      const value = props[attr.key];
      if (value !== null && value !== undefined && value !== '') {
        html += `<tr><td>${attr.display}</td><td>${value}</td></tr>`;
      }
    });
  } 
  else if (featureType === 'Bus Line') {
    const props = feature.properties;
    const attributes = [
      { key: 'lines_diva4', display: 'Line ID' },
      { key: 'service_name', display: 'Service Name' },
      { key: 'direction', display: 'Direction' },
      { key: 'am_peak_service_frequency', display: 'AM Peak Frequency' },
      { key: 'operator', display: 'Operator' }
    ];
    
    attributes.forEach(attr => {
      const value = props[attr.key];
      if (value !== null && value !== undefined && value !== '') {
        html += `<tr><td>${attr.display}</td><td>${value}</td></tr>`;
      }
    });
  }
  
  html += '</table>';
  return html;
}

function showInfrastructurePopup(latlng, nearbyFeatures) {
  const busLineFeatures = nearbyFeatures.busLines;
  const busStopFeatures = nearbyFeatures.busStops;
  
  let combinedBusFrequency = 0;
  if (busLineFeatures.length > 0) {
    combinedBusFrequency = busLineFeatures.reduce((total, current) => {
      const frequency = current.feature.properties.am_peak_service_frequency;
      return total + (parseFloat(frequency) || 0);
    }, 0);
  }
  
  const allFeatures = [
    ...busStopFeatures, 
    ...busLineFeatures
  ];
  
  if (allFeatures.length === 0) return;
  
  let currentIndex = 0;
  const totalFeatures = allFeatures.length;
  let popup = null;
  let highlightedLayer = null;
  
  function highlightCurrentFeature() {
    if (highlightedLayer) {
      map.removeLayer(highlightedLayer);
      highlightedLayer = null;
    }
    
    const currentFeature = allFeatures[currentIndex];
    const isStopFeature = busStopFeatures.includes(currentFeature);
    
    if (isStopFeature) {
      highlightedLayer = L.circleMarker(
        currentFeature.layer.getLatLng(), 
        {
          radius: 8,
          color: '#FFFF00',
          weight: 4,
          opacity: 0.8,
          fill: false
        }
      ).addTo(map);
    } else {
      const lineStyle = {
        color: '#FFFF00',
        weight: 6,
        opacity: 0.8
      };
      
      const featureGeoJSON = currentFeature.layer.toGeoJSON();
      highlightedLayer = L.geoJSON(featureGeoJSON, {
        style: lineStyle
      }).addTo(map);
    }
  }
  
  function updatePopupContent() {
    const currentFeature = allFeatures[currentIndex];
    const featureType = busStopFeatures.includes(currentFeature) ? 'Bus Stop' : 'Bus Line';
    
    const template = document.getElementById('infrastructure-popup-template');
    const content = document.importNode(template.content, true);
    
    content.querySelector('[data-field="feature-type"]').textContent = featureType;
    content.querySelector('[data-field="current-index"]').textContent = currentIndex + 1;
    content.querySelector('[data-field="total-features"]').textContent = totalFeatures;
    
    const frequencyContainer = content.querySelector('[data-field="frequency-container"]');
    if (busLineFeatures.length > 0 && featureType === 'Bus Line') {
      frequencyContainer.style.display = 'block';
      content.querySelector('[data-field="combined-frequency"]').textContent = Math.round(combinedBusFrequency);
    }
    
    content.querySelector('[data-field="content"]').innerHTML = formatFeatureProperties(currentFeature.feature, featureType);
    
    const footer = content.querySelector('[data-field="footer"]');
    if (totalFeatures > 1) {
      footer.style.display = 'flex';
      const prevBtn = content.querySelector('[data-field="prev-btn"]');
      const nextBtn = content.querySelector('[data-field="next-btn"]');
      
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === totalFeatures - 1;
    }
    
    const div = document.createElement('div');
    div.appendChild(content);
    popup.setContent(div.innerHTML);
    
    highlightCurrentFeature();
    
    setTimeout(() => {
      const prevBtn = document.getElementById('prev-feature');
      const nextBtn = document.getElementById('next-feature');
      
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (currentIndex > 0) {
            currentIndex--;
            updatePopupContent();
          }
        });
      }
      
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (currentIndex < totalFeatures - 1) {
            currentIndex++;
            updatePopupContent();
          }
        });
      }
    }, 10);
  }
  
  popup = L.popup({
    autoPan: true,
    closeButton: true,
    closeOnClick: false
  })
    .setLatLng(latlng)
    .setContent('Loading...')
    .openOn(map);
  
  popup.on('remove', function() {
    if (highlightedLayer) {
      map.removeLayer(highlightedLayer);
      highlightedLayer = null;
    }
  });
  
  updatePopupContent();
}

function updateYearDropdownLabel() {
  const yearDropdown = document.getElementById('yearDropdown');
  const selectedYear = document.querySelector('input[name="academic-year"]:checked');
  
  if (selectedYear) {
    const yearValue = selectedYear.value;
    const startYear = '20' + yearValue.substring(0, 2);
    const endYear = '20' + yearValue.substring(2, 4);
    yearDropdown.textContent = `${startYear}/${endYear}`;
  } else {
    yearDropdown.textContent = '2024/25';
    const defaultYear = document.querySelector('input[name="academic-year"][value="2425"]');
    if (defaultYear) defaultYear.checked = true;
  }
}

function updateSubjectDropdownLabel() {
  const subjectDropdown = document.getElementById('subjectDropdown');
  const subjectCheckboxes = document.getElementById('subjectCheckboxesContainer').querySelectorAll('input[type="checkbox"]');
  const selectedCheckboxes = Array.from(subjectCheckboxes).filter(checkbox => checkbox.checked);
  
  if (selectedCheckboxes.length === 0) {
    subjectDropdown.textContent = '\u00A0';
  } else if (selectedCheckboxes.length === 1) {
    const nextSibling = selectedCheckboxes[0].nextElementSibling;
    subjectDropdown.textContent = nextSibling ? nextSibling.textContent : selectedCheckboxes[0].value;
  } else {
    subjectDropdown.textContent = 'Multiple Subjects';
  }
}

function updateAimLevelDropdownLabel() {
  const aimLevelDropdown = document.getElementById('aimlevelDropdown');
  const aimLevelCheckboxes = document.getElementById('aimlevelCheckboxesContainer').querySelectorAll('input[type="checkbox"]');
  const selectedCheckboxes = Array.from(aimLevelCheckboxes).filter(checkbox => checkbox.checked);
  
  if (selectedCheckboxes.length === 0) {
    aimLevelDropdown.textContent = '\u00A0';
  } else if (selectedCheckboxes.length === 1) {
    const nextSibling = selectedCheckboxes[0].nextElementSibling;
    aimLevelDropdown.textContent = nextSibling ? nextSibling.textContent : selectedCheckboxes[0].value;
  } else {
    aimLevelDropdown.textContent = 'Multiple Levels';
  }
}

function updateLayerStyles() {
  if (AmenitiesCatchmentLayer && isPanelOpen("Journey Time Catchments - Training Centres")) {
    applyAmenitiesCatchmentLayerStyling();
  }
}

function showAmenityCatchment(amenityType, amenityId) {
  // console.log('showAmenityCatchment called');
  const panelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
    
  panelHeaders.forEach(header => {
    header.classList.add("collapsed");
    header.nextElementSibling.style.display = "none";
    
    if (header.textContent.includes("Journey Time Catchments - Training Centres") && AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }
  });
  
  selectingFromMap = true;
  selectedAmenitiesFromMap = [amenityId];
  selectedAmenitiesAmenities = [amenityType];
  
  const amenitiesHeader = Array.from(panelHeaders).find(header => 
    header.textContent.includes("Journey Time Catchments - Training Centres"));
  
  if (amenitiesHeader) {
    amenitiesHeader.classList.remove("collapsed");
    amenitiesHeader.nextElementSibling.style.display = "block";
    
    AmenitiesPurpose.forEach(checkbox => {
      checkbox.checked = false;
    });
    
    const checkbox = Array.from(AmenitiesPurpose).find(checkbox => checkbox.value === amenityType);
    if (checkbox) {
      checkbox.checked = true;
    }
    
    const amenitiesDropdown = document.getElementById('amenitiesDropdown');
    if (amenitiesDropdown) {
      const typeLabel = getAmenityTypeDisplayName(amenityType);
      amenitiesDropdown.textContent = `${typeLabel} (ID: ${amenityId})`;
    }
    
    updateAmenitiesCatchmentLayer();
  }
}

function drawSelectedTrainingCentres() {
  const selectedSubjects = Array.from(
    document.querySelectorAll('#subjectCheckboxesContainer input[type="checkbox"]:checked')
  ).map(cb => cb.value);
  
  const selectedAimLevels = Array.from(
    document.querySelectorAll('#aimlevelCheckboxesContainer input[type="checkbox"]:checked')
  ).map(cb => cb.value);
  
  const selectedYearElem = document.querySelector('input[name="academic-year"]:checked');
  const currentYear = selectedYearElem ? selectedYearElem.value : '2425';
  
  if (selectedSubjects.length === 0 || selectedAimLevels.length === 0) {
    amenitiesLayerGroup.clearLayers();
    return;
  }

  const filteredCentres = trainingCentresData.features.filter(feature => {
    const hasSelectedAimLevel = selectedAimLevels.some(level => 
      feature.properties[`AimLevel_${level}`] && 
      parseInt(feature.properties[`AimLevel_${level}`]) > 0
    );
    
    const hasSelectedSubject = selectedSubjects.some(subject => 
      feature.properties[`${currentYear}_${subject.toLowerCase()}`] && 
      parseInt(feature.properties[`${currentYear}_${subject.toLowerCase()}`]) > 0
    );
    
    return hasSelectedAimLevel && hasSelectedSubject;
  });
  
  amenitiesLayerGroup.clearLayers();
  
  if (filteredCentres.length > 0) {
    const geoJsonLayer = L.geoJSON({
      type: 'FeatureCollection',
      features: filteredCentres
    }, {
      pointToLayer: (feature, latlng) => {
        const icon = L.divIcon({ 
          className: 'fa-icon', 
          html: '<div class="pin"><i class="fas fa-university" style="color: grey;"></i></div>', 
          iconSize: [60, 60], 
          iconAnchor: [15, 15] 
        });
        
        const marker = L.marker(latlng, { icon: icon });
        
        marker.on('click', function() {
          const properties = feature.properties;
          const popupContent = `
            <strong>Provider:</strong> ${properties.Provider || 'Unknown'}<br>
            <strong>ID:</strong> ${properties.id || 'Unknown'}<br>
            <strong>Postcode:</strong> ${properties.postcode || 'Unknown'}<br>
            ${getTrainingcentreDetails(properties, currentYear)}
            <br><button class="show-catchment-btn" data-amenity-type="trainingCentres" data-amenity-id="${properties.id}">Show Journey Time Catchment</button>
          `;
          
          L.popup()
            .setLatLng(latlng)
            .setContent(popupContent)
            .openOn(map);
            
          setTimeout(() => {
            const showCatchmentButton = document.querySelector('.show-catchment-btn');
            if (showCatchmentButton) {
              showCatchmentButton.addEventListener('click', function() {
                const amenityId = this.getAttribute('data-amenity-id');
                showAmenityCatchment('trainingCentres', amenityId);
              });
            }
          }, 100);
        });
        
        return marker;
      }
    });
    
    amenitiesLayerGroup.addLayer(geoJsonLayer);
    
    if (document.getElementById('amenitiesCheckbox')?.checked) {
      amenitiesLayerGroup.addTo(map);
    }
  }
}

function getTrainingcentreDetails(properties, currentYear) {
  let details = '';
  
  const aimLevels = [];
  if (properties.AimLevel_E > 0) aimLevels.push('Entry level');
  if (properties.AimLevel_X > 0) aimLevels.push('X level');
  if (properties.AimLevel_1 > 0) aimLevels.push('Level 1');
  if (properties.AimLevel_2 > 0) aimLevels.push('Level 2');
  if (properties.AimLevel_3 > 0) aimLevels.push('Level 3');
  
  if (aimLevels.length > 0) {
    details += `<strong>Aim Levels:</strong> ${aimLevels.join(', ')}<br>`;
  }
  
  const subjects = [];
  const subjectTypes = ['digital', 'engineering', 'construction'];
  
  for (const subject of subjectTypes) {
    const key = `${currentYear}_${subject}`;
    if (properties[key] && parseInt(properties[key]) > 0) {
      const yearFormatted = `20${currentYear.substring(0, 2)}-20${currentYear.substring(2, 4)}`;
      subjects.push(`${subject.charAt(0).toUpperCase() + subject.slice(1)} (${yearFormatted})`);
    }
  }
  
  if (subjects.length > 0) {
    details += `<strong>Subjects:</strong> ${subjects.join(', ')}`;
  }
  
  return details;
}

function updateAmenitiesCatchmentLayer() {
  if (!initialLoadComplete || !isPanelOpen("Journey Time Catchments - Training Centres")) {
    return;
  }

  const selectedSubjects = Array.from(
    document.querySelectorAll('#subjectCheckboxesContainer input[type="checkbox"]:checked')
  ).map(cb => cb.value);
  
  const selectedAimLevels = Array.from(
    document.querySelectorAll('#aimlevelCheckboxesContainer input[type="checkbox"]:checked')
  ).map(cb => cb.value);
  
  const selectedYearElem = document.querySelector('input[name="academic-year"]:checked');
  const currentYear = selectedYearElem ? selectedYearElem.value : '2425';
  
  if (selectedSubjects.length === 0 || selectedAimLevels.length === 0) {
    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }
    drawSelectedTrainingCentres();
    updateLegend();
    updateFilterDropdown();
    updateSummaryStatistics([]);
    return;
  }

  const filteredCentres = trainingCentresData.features.filter(feature => {
    const hasSelectedAimLevel = selectedAimLevels.some(level => 
      feature.properties[`AimLevel_${level}`] && 
      parseInt(feature.properties[`AimLevel_${level}`]) > 0
    );
    
    const hasSelectedSubject = selectedSubjects.some(subject => 
      feature.properties[`${currentYear}_${subject.toLowerCase()}`] && 
      parseInt(feature.properties[`${currentYear}_${subject.toLowerCase()}`]) > 0
    );
    
    return hasSelectedAimLevel && hasSelectedSubject;
  });
  
  selectingFromMap = true;
  selectedAmenitiesAmenities = ['trainingCentres'];
  selectedAmenitiesFromMap = filteredCentres.map(feature => feature.properties.id.toString());
  
  if (selectedAmenitiesFromMap.length === 0) {
    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }
    drawSelectedTrainingCentres();
    updateLegend();
    updateFilterDropdown();
    updateSummaryStatistics([]);
    return;
  }

  gridTimeMap = {};

  const cacheKeys = selectedAmenitiesAmenities.map(amenity => `${amenity}`);  
  const fetchPromises = cacheKeys.map(cacheKey => {  
    if (!csvDataCache[cacheKey]) {
      const csvPath = `https://AmFa6.github.io/TrainingCentres/${cacheKey}_csv.csv`;
      return fetch(csvPath)
        .then(response => response.text())
        .then(csvText => {
          const csvData = Papa.parse(csvText, { header: true }).data;
          
          let matchCount = 0;
          csvData.forEach(row => {
            if (selectingFromMap && selectedAmenitiesFromMap.length > 0) {
              let isMatch = false;
              
              const selectedId = selectedAmenitiesFromMap[0];
              
              const rowId = row.Tracc_ID;
              
              if (selectedId === rowId) {
                isMatch = true;
              }
              else if (!isNaN(parseFloat(rowId)) && !isNaN(parseFloat(selectedId))) {
                if (parseFloat(selectedId) === parseFloat(rowId)) {
                  isMatch = true;
                }
              }
              else if (rowId && rowId.includes('.') && 
                        rowId.substring(0, rowId.indexOf('.')) === selectedId) {
                isMatch = true;
              }
              
              if (isMatch) {
                if (matchCount < 3) {
                  matchCount++;
                }
                const coreid = row.OriginName;
                const time = parseFloat(row.Time);
                if (!gridTimeMap[coreid] || time < gridTimeMap[coreid]) {
                  gridTimeMap[coreid] = time;
                }
              }
            } else {
              const coreid = row.OriginName;
              const time = parseFloat(row.Time);
              if (!gridTimeMap[coreid] || time < gridTimeMap[coreid]) {
                gridTimeMap[coreid] = time;
              }
            }
          });
          
          csvDataCache[cacheKey] = csvData;
        });
    } else {
      const csvData = csvDataCache[cacheKey];
      
      let matchCount = 0;
      csvData.forEach(row => {
        if (row.Mode === selectedMode) {
          if (selectingFromMap && selectedAmenitiesFromMap.length > 0) {
            let isMatch = false;
            
            const selectedId = selectedAmenitiesFromMap[0];
            
            const rowId = row.Tracc_ID;
            
            if (selectedId === rowId) {
              isMatch = true;
            }
            else if (!isNaN(parseFloat(rowId)) && !isNaN(parseFloat(selectedId))) {
              if (parseFloat(selectedId) === parseFloat(rowId)) {
                isMatch = true;
              }
            }
            else if (rowId && rowId.includes('.') && 
                     rowId.substring(0, rowId.indexOf('.')) === selectedId) {
              isMatch = true;
            }
            
            if (isMatch) {
              if (matchCount < 3) {
                matchCount++;
              }
              const coreid = row.OriginName;
              const time = parseFloat(row.Time);
              if (!gridTimeMap[coreid] || time < gridTimeMap[coreid]) {
                gridTimeMap[coreid] = time;
              }
            }
          } else {
            const coreid = row.OriginName;
            const time = parseFloat(row.Time);
            if (!gridTimeMap[coreid] || time < gridTimeMap[coreid]) {
              gridTimeMap[coreid] = time;
            }
          }
        }
      });
      
      return Promise.resolve();
    }
  });

  Promise.all(fetchPromises).then(() => {    
    grid.features.forEach(feature => {
      const coreid = feature.properties.COREID;
      if (gridTimeMap[coreid] === undefined) {
        gridTimeMap[coreid] = 120;
      }
    });

    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }

    const filteredFeatures = grid.features.map(feature => {
      const coreid = feature.properties.COREID;
      const time = gridTimeMap[coreid];
      return {
        ...feature,
        properties: {
          ...feature.properties,
          time: time
        }
      };
    });
    
    const filteredAmenitiesCatchmentLayer = {
      type: "FeatureCollection",
      features: filteredFeatures
    };
    
    AmenitiesCatchmentLayer = L.geoJSON(filteredAmenitiesCatchmentLayer, {
      pane: 'polygonLayers',
    }).addTo(map);
    AmenitiesCatchmentLayer._currentMode = selectedMode;

    applyAmenitiesCatchmentLayerStyling();

    if (selectingFromMap) {
      const selectedAmenityTypes = selectedAmenitiesAmenities;
      drawSelectedTrainingCentres(selectedAmenityTypes);
    } else {
      drawSelectedTrainingCentres(selectedAmenitiesAmenities);
      updateAmenitiesDropdownLabel();
    }

    updateLegend();
    updateFeatureVisibility();
    updateFilterDropdown();
    updateFilterValues();
    updateSummaryStatistics(filteredFeatures);
    highlightSelectedArea();
  });
}

function applyAmenitiesCatchmentLayerStyling() {
  // console.log('applyAmenitiesCatchmentLayerStyling called from:');
  if (!AmenitiesCatchmentLayer) return;

  const minOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? 
    parseFloat(AmenitiesOpacityRange.noUiSlider.get()[0]) : 0;
  const maxOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? 
    parseFloat(AmenitiesOpacityRange.noUiSlider.get()[1]) : 0;
  const minOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? 
    parseFloat(AmenitiesOutlineRange.noUiSlider.get()[0]) : 0;
  const maxOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? 
    parseFloat(AmenitiesOutlineRange.noUiSlider.get()[1]) : 0;
  
  AmenitiesCatchmentLayer.eachLayer(layer => {
    const feature = layer.feature;
    const coreid = feature.properties.COREID;
    const time = gridTimeMap[coreid];
    let color = 'transparent';

    if (time !== undefined) {
      if (time <= 5) color = '#fde725';
      else if (time <= 10) color = '#8fd744';
      else if (time <= 15) color = '#35b779';
      else if (time <= 20) color = '#21908d';
      else if (time <= 25) color = '#31688e';
      else if (time <= 30) color = '#443a82';
      else color = '#440154';
    }

    let opacity;
    if (AmenitiesOpacity.value === 'None') {
      opacity = 0.5;
    } else {
      const opacityValue = feature.properties[AmenitiesOpacity.value];
      if (opacityValue === 0 || opacityValue === null || opacityValue === undefined) {
        opacity = isInverseAmenitiesOpacity ? 0.5 : 0.1;
      } else {
        opacity = scaleExp(opacityValue, minOpacityValue, maxOpacityValue, 0.1, 0.8, opacityAmenitiesOrder);
      }
    }
    
    let weight;
    if (AmenitiesOutline.value === 'None') {
      weight = 0;
    } else {
      const outlineValue = feature.properties[AmenitiesOutline.value];
      if (outlineValue === 0 || outlineValue === null || outlineValue === undefined || outlineValue === '') {
        weight = 0;
      } else {
        weight = scaleExp(outlineValue, minOutlineValue, maxOutlineValue, 0, 4, outlineAmenitiesOrder);
      }
    }

    layer.options._originalStyling = {
      opacity: 1,
      fillOpacity: opacity
    };

    layer.setStyle({
      fillColor: color,
      weight: weight,
      opacity: 1,
      color: 'black',
      fillOpacity: opacity
    });
  });
  
  updateFeatureVisibility();
}

function updateFilterDropdown() {
  if (isUpdatingFilters) return;
  // console.log('updateFilterDropdown called from:');
  isUpdatingFilters = true;
  const filterTypeDropdown = document.getElementById('filterTypeDropdown');
  if (!filterTypeDropdown) {
    isUpdatingFilters = false;
    return;
  }
  
  const currentValue = filterTypeDropdown.value;
  
  filterTypeDropdown.innerHTML = '';
  
  const standardOptions = [
    { value: 'LA', text: 'Local Authority' },
    { value: 'Ward', text: 'Ward' },
    { value: 'GrowthZone', text: 'Growth Zone' },
    { value: 'WestLinkZone', text: 'WESTlink Zone' }
  ];
  
  if (AmenitiesCatchmentLayer) {
    standardOptions.push({ value: 'Range', text: 'Range (see Legend)' });
  }
  
  standardOptions.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    filterTypeDropdown.appendChild(optionElement);
  });
  
  
  if ((currentValue === 'Range' && !(AmenitiesCatchmentLayer)) ||
      !Array.from(filterTypeDropdown.options).some(opt => opt.value === currentValue)) {
    filterTypeDropdown.value = 'LA';
  } else {
    filterTypeDropdown.value = currentValue;
  }
  
  isUpdatingFilters = false;
}

function updateFilterValues() {
  if (isUpdatingFilterValues) return;
  // console.log('updateFilterValues called from:');
  isUpdatingFilterValues = true;

  if (!filterTypeDropdown.value) {
    filterTypeDropdown.value = AmenitiesCatchmentLayer ? 'Range' : 'LA';
  }
  
  const currentFilterType = filterTypeDropdown.value;
  
  let filterValueButton = document.getElementById('filterValueButton');
  const filterValueContainer = document.getElementById('filterValueContainer');
  
  if (filterValueContainer) {
    filterValueContainer.innerHTML = '';
  }
  
  if (!filterValueButton) {
    if (filterValueDropdown && filterValueDropdown.parentNode) {
      const dropdownButton = document.createElement('button');
      dropdownButton.type = 'button';
      dropdownButton.className = 'dropdown-toggle';
      dropdownButton.id = 'filterValueButton';
      dropdownButton.textContent = '';
      dropdownButton.style.minHeight = '28px';
      
      const dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'dropdown';
      dropdownContainer.style.width = '100%';
      
      const dropdownMenu = document.createElement('div');
      dropdownMenu.className = 'dropdown-menu';
      dropdownMenu.id = 'filterValueContainer';
      dropdownMenu.style.width = '100%';
      dropdownMenu.style.boxSizing = 'border-box';
      
      dropdownContainer.appendChild(dropdownButton);
      dropdownContainer.appendChild(dropdownMenu);
      
      if (filterValueDropdown.parentNode) {
        filterValueDropdown.parentNode.replaceChild(dropdownContainer, filterValueDropdown);
      }
      
      dropdownButton.addEventListener('click', () => {
        dropdownMenu.classList.toggle('show');
      });
      
      window.addEventListener('click', (event) => {
        if (!event.target.matches('#filterValueButton') && !event.target.closest('#filterValueContainer')) {
          dropdownMenu.classList.remove('show');
        }
      });
    }
  }

  filterValueButton = document.getElementById('filterValueButton');

  if (!filterValueContainer) {
    isUpdatingFilterValues = false;
    return;
  }
  
  filterValueContainer.innerHTML = '';

  let options = [];
  let filterFieldSelector = null;

  if (currentFilterType === 'Range') {
    if (AmenitiesCatchmentLayer) {
      options = [
        '0-5', '5-10', '10-15', '15-20', '20-25', '25-30', '>30'
      ];
    }
  } else if (currentFilterType === 'Ward') {
    const wardNames = new Set();
    if (wardBoundariesLayer) {
      wardBoundariesLayer.getLayers().forEach(layer => {
        const wardName = layer.feature.properties.WD24NM;
        wardNames.add(wardName);
      });
      options = Array.from(wardNames).sort();
    }
  } else if (currentFilterType === 'GrowthZone') {
    if (GrowthZonesLayer) {
      options = GrowthZonesLayer.getLayers().map(layer => layer.feature.properties.Name).sort();
    }
  } else if (currentFilterType === 'WestLinkZone') {
    if (WestLinkZonesLayer) {
      options = WestLinkZonesLayer.getLayers().map(layer => layer.feature.properties.name).sort();
    }
  } else if (currentFilterType === 'LA') {
    options = ['MCA', 'LEP'];
    if (uaBoundariesLayer) {
      const uaOptions = uaBoundariesLayer.getLayers()
        .map(layer => layer.feature.properties.LAD24NM)
        .sort();
      options = options.concat(uaOptions);
    }
  }

  const selectAllLabel = document.createElement('label');
  selectAllLabel.className = 'checkbox-label';
  
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.id = 'select-all-filter';
  selectAllCheckbox.checked = false;
  
  const selectAllSpan = document.createElement('span');
  selectAllSpan.innerHTML = '<i>Select/Deselect All</i>';
  
  selectAllLabel.appendChild(selectAllCheckbox);
  selectAllLabel.appendChild(selectAllSpan);
  filterValueContainer.appendChild(selectAllLabel);

  const previouslySelected = previousFilterSelections[currentFilterType] || [];

  const checkboxes = [];
  options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `filter-${option.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
    checkbox.value = option;
    
    checkbox.checked = previouslySelected.length > 0 ? 
      previouslySelected.includes(option) : 
      index === 0;
    
    checkbox.className = 'filter-value-checkbox';
    checkboxes.push(checkbox);
    
    const span = document.createElement('span');
    span.textContent = option;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    filterValueContainer.appendChild(label);
    
    checkbox.addEventListener('change', function() {
      updateStoredSelections();
      updateFilterButtonText();
      updateSummaryStatistics(getCurrentFeatures());
      if (document.getElementById('highlightAreaCheckbox').checked) {
        highlightSelectedArea();
      }
    });
  });
  
  selectAllCheckbox.addEventListener('change', function() {
    const isChecked = this.checked;
    checkboxes.forEach(cb => cb.checked = isChecked);
    updateStoredSelections();
    updateFilterButtonText();
    updateSummaryStatistics(getCurrentFeatures());
    if (document.getElementById('highlightAreaCheckbox').checked) {
      highlightSelectedArea();
    }
  });
  
  function updateStoredSelections() {
    const currentSelections = checkboxes
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    
    previousFilterSelections[currentFilterType] = currentSelections;
  }
  
  function updateFilterButtonText() {
    const selectedValues = checkboxes
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    
    if (selectedValues.length === 0) {
      filterValueButton.textContent = '\u00A0';
      filterValueButton.style.minHeight = '28px';
    } else {
      filterValueButton.textContent = selectedValues.join(', ');
    }
  }
  
  const allChecked = checkboxes.every(cb => cb.checked);
  const anyChecked = checkboxes.some(cb => cb.checked);
  selectAllCheckbox.checked = allChecked;
  selectAllCheckbox.indeterminate = anyChecked && !allChecked;
  
  updateFilterButtonText();
  requestAnimationFrame(() => {
    updateSummaryStatistics(getCurrentFeatures());
    isUpdatingFilterValues = false;
  });
}

function updateSummaryStatistics(features) {
  if (isCalculatingStats) return;
  // console.log('updateSummaryStatistics called from:');
  isCalculatingStats = true;
  
  requestAnimationFrame(() => {
    if (!grid && (!features || features.length === 0)) {
      displayEmptyStatistics();
      isCalculatingStats = false;
      return;
    }
    
    const filterValueContainer = document.getElementById('filterValueContainer');
    if (filterValueContainer) {
      const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
        .map(checkbox => checkbox.value);
      
      if (selectedValues.length === 0) {
        displayEmptyStatistics();
        isCalculatingStats = false;
        return;
      }
    }
    
    const filteredFeatures = applyFilters(features);
    
    if (!filteredFeatures || filteredFeatures.length === 0) {
      displayEmptyStatistics();
      isCalculatingStats = false;
      return;
    }
    
    const stats = calculateStatistics(filteredFeatures);
    updateStatisticsUI(stats);
    isCalculatingStats = false;
  });
}

function displayEmptyStatistics() {
  // console.log('displayEmptyStatistics called from:');
  const statisticIds = [
    'total-population', 'min-population', 'max-population',
    'avg-imd-score', 'min-imd-score', 'max-imd-score',
    'avg-imd-decile', 'min-imd-decile', 'max-imd-decile',
    'avg-car-availability', 'min-car-availability', 'max-car-availability',
    'total-growth-pop', 'min-growth-pop', 'max-growth-pop',
    'avg-score', 'min-score', 'max-score',
    'avg-percentile', 'min-percentile', 'max-percentile', 'metric-row-2'
  ];
  
  statisticIds.forEach(id => {
    document.getElementById(id).textContent = '-';
  });
  
  const amenityTypes = ['PriSch', 'SecSch', 'FurEd', 'Em500', 'Em5000', 'StrEmp', 'CitCtr', 'MajCtr', 'DisCtr', 'GP', 'Hos'];
  amenityTypes.forEach(type => {
    const element = document.getElementById(`count-${type}`);
    if (element) element.textContent = '-';
  });
}

function applyFilters(features) {
  // console.log('applyFilters called from:');
  const filterType = filterTypeDropdown.value;
  
  let filteredFeatures = features && features.length ? features : (grid ? grid.features : []);
  
  if ((AmenitiesCatchmentLayer) && (!features || features.length === 0)) {
    if (AmenitiesCatchmentLayer) {
      filteredFeatures = AmenitiesCatchmentLayer.toGeoJSON().features;
    }
  }
  
  if (filterType === 'Range') {
    const filterValueContainer = document.getElementById('filterValueContainer');
    if (!filterValueContainer) return filteredFeatures;
    
    const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
      .map(checkbox => checkbox.value);
    
    if (selectedValues.length === 0) return [];
    
    const combinedFeatures = [];
    selectedValues.forEach(filterValue => {
      const rangeFiltered = applyRangeFilter(filteredFeatures, filterValue);
      rangeFiltered.forEach(feature => {
        if (!combinedFeatures.includes(feature)) {
          combinedFeatures.push(feature);
        }
      });
    });
    
    filteredFeatures = combinedFeatures;
  } 
  else if (['Ward', 'GrowthZone', 'WestLinkZone', 'LA'].includes(filterType)) {
    const filterValueContainer = document.getElementById('filterValueContainer');
    if (!filterValueContainer) return filteredFeatures;
    
    const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
      .map(checkbox => checkbox.value);
    
    if (selectedValues.length === 0) return [];
    
    const combinedFeatures = [];
    selectedValues.forEach(filterValue => {
      const geographicFiltered = applyGeographicFilter(filteredFeatures, filterType, filterValue);
      geographicFiltered.forEach(feature => {
        if (!combinedFeatures.some(f => f.properties.COREID === feature.properties.COREID)) {
          combinedFeatures.push(feature);
        }
      });
    });
    
    filteredFeatures = combinedFeatures;
  }
  
  return filteredFeatures;
}

function applyRangeFilter(features, filterValue) {
  // console.log('applyRangeFilter called from:');
  if (AmenitiesCatchmentLayer) {
    return filterByJourneyTime(features, filterValue);
  }
  
  return features;
}

function applyGeographicFilter(features, filterType, filterValue) {
  // console.log('applyGeographicFilter called from:');
  const getPolygonForFilter = () => {
    let polygon = null;

    if (filterType === 'Ward') {
      if (!wardBoundariesLayer) return null;

      const wardLayers = wardBoundariesLayer.getLayers().filter(layer =>
        layer.feature.properties.WD24NM === filterValue
      );

      polygon = wardLayers.reduce((acc, layer) => {
        const poly = layer.toGeoJSON();
        return acc ? turf.union(acc, poly) : poly;
      }, null);
    } else if (filterType === 'GrowthZone') {
      if (!GrowthZonesLayer) return null;

      const growthZoneLayer = GrowthZonesLayer.getLayers().find(layer =>
        layer.feature.properties.Name === filterValue
      );
      polygon = growthZoneLayer?.toGeoJSON();
    } else if (filterType === 'WestLinkZone') {
      if (!WestLinkZonesLayer) return null;

      const WestLinkZoneLayer = WestLinkZonesLayer.getLayers().find(layer =>
        layer.feature.properties.name === filterValue
      );
      polygon = WestLinkZoneLayer?.toGeoJSON();
    } else if (filterType === 'LA') {
      if (!uaBoundariesLayer) return null;

      if (filterValue === 'MCA') {
        const mcaLayers = uaBoundariesLayer.getLayers().filter(layer =>
          layer.feature.properties.LAD24NM !== 'North Somerset'
        );
        polygon = mcaLayers.reduce((acc, layer) => {
          const poly = layer.toGeoJSON();
          return acc ? turf.union(acc, poly) : poly;
        }, null);
      } else if (filterValue === 'LEP') {
        const lepLayers = uaBoundariesLayer.getLayers();
        polygon = lepLayers.reduce((acc, layer) => {
          const poly = layer.toGeoJSON();
          return acc ? turf.union(acc, poly) : poly;
        }, null);
      } else {
        const uaLayer = uaBoundariesLayer.getLayers().find(layer =>
          layer.feature.properties.LAD24NM === filterValue
        );
        polygon = uaLayer?.toGeoJSON();
      }
    }

    return polygon;
  };

  const polygon = getPolygonForFilter();
  if (!polygon) return features;

  return features.filter(feature => {
    const gridPolygon = turf.polygon(feature.geometry.coordinates);
    
    let centrePoint;
    centrePoint = turf.center(gridPolygon);
    
    return turf.booleanPointInPolygon(centrePoint, polygon);
  });
}

function calculateStatistics(features) {
  // console.log('calculateStatistics called from:');
  const baseStats = calculateBaseStatistics(features);
  
  let layerStats = {};
  
  if (AmenitiesCatchmentLayer) {
    layerStats = calculateTimeStatistics(features);
  }
  
  const amenityCounts = countAmenitiesByType(features);
  
  return {...baseStats, ...layerStats, amenityCounts};
}

function calculateBaseStatistics(features) {
  // console.log('calculateBaseStatistics called from:');
  const metrics = {
    population: [],
    imd_score: [],
    imd_decile: [],
    carAvailability: [],
    growthpop: []
  };

  features.forEach(feature => {
    const props = feature.properties;
    metrics.population.push(props.pop || 0);
    metrics.imd_score.push(props.IMDScore || 0);
    metrics.imd_decile.push(props.IMD_Decile || 0);
    metrics.carAvailability.push(props.car_availability || 0);
    metrics.growthpop.push(props.pop_growth || 0);
  });

  return {
    totalPopulation: metrics.population.reduce((a, b) => a + b, 0),
    minPopulation: Math.min(...metrics.population.filter(val => val > 0), Infinity) || 0,
    maxPopulation: Math.max(...metrics.population, 0),
    avgImdScore: calculateWeightedAverage(metrics.imd_score, metrics.population),
    minImdScore: Math.min(...metrics.imd_score.filter((val, index) => val > 0 && metrics.population[index] > 0), Infinity) || 0,
    maxImdScore: Math.max(...metrics.imd_score, 0),
    avgImdDecile: calculateWeightedAverage(metrics.imd_decile, metrics.population),
    minImdDecile: Math.min(...metrics.imd_decile.filter((val, index) => val > 0 && metrics.population[index] > 0), Infinity) || 0,
    maxImdDecile: Math.max(...metrics.imd_decile, 0),
    avgCarAvailability: calculateWeightedAverage(metrics.carAvailability, metrics.population),
    minCarAvailability: Math.min(...metrics.carAvailability.filter((val, index) => val > 0 && metrics.population[index] > 0), Infinity) || 0,
    maxCarAvailability: Math.max(...metrics.carAvailability, 0),
    totalgrowthpop: metrics.growthpop.reduce((a, b) => a + b, 0),
    mingrowthpop: Math.min(...metrics.growthpop, 0),
    maxgrowthpop: Math.max(...metrics.growthpop, 0)
  };
}

function calculateTimeStatistics(features) {
  // console.log('calculateTimeStatistics called from:');
  const metrics = {
    time: [],
    population: []
  };

  features.forEach(feature => {
    const props = feature.properties;
    const coreid = props.COREID;
    const time = gridTimeMap[coreid] !== undefined ? gridTimeMap[coreid] : 0;
    metrics.time.push(time);
    metrics.population.push(props.pop || 0);
  });

  return {
    avgTime: calculateWeightedAverage(metrics.time, metrics.population),
    minTime: Math.min(...metrics.time.filter(val => val > 0), Infinity) || 0,
    maxTime: Math.max(...metrics.time, 0),
    metricRow1: '-',
    metricRow2: 'Journey Time',
    isTimeLayer: true
  };
}

function updateStatisticsUI(stats) {
  document.getElementById('total-population').textContent = formatValue(stats.totalPopulation, 10);
  document.getElementById('min-population').textContent = formatValue(stats.minPopulation, 10);
  document.getElementById('max-population').textContent = formatValue(stats.maxPopulation, 10);
  document.getElementById('avg-imd-score').textContent = formatValue(stats.avgImdScore, 0.1);
  document.getElementById('min-imd-score').textContent = formatValue(stats.minImdScore, 0.1);
  document.getElementById('max-imd-score').textContent = formatValue(stats.maxImdScore, 0.1);
  document.getElementById('avg-imd-decile').textContent = formatValue(stats.avgImdDecile, 1);
  document.getElementById('min-imd-decile').textContent = formatValue(stats.minImdDecile, 1);
  document.getElementById('max-imd-decile').textContent = formatValue(stats.maxImdDecile, 1);
  document.getElementById('avg-car-availability').textContent = formatValue(stats.avgCarAvailability, 0.01);
  document.getElementById('min-car-availability').textContent = formatValue(stats.minCarAvailability, 0.01);
  document.getElementById('max-car-availability').textContent = formatValue(stats.maxCarAvailability, 0.01);
  document.getElementById('total-growth-pop').textContent = formatValue(stats.totalgrowthpop, 10);
  document.getElementById('min-growth-pop').textContent = formatValue(stats.mingrowthpop, 10);
  document.getElementById('max-growth-pop').textContent = formatValue(stats.maxgrowthpop, 10);

  document.getElementById('metric-row-2').textContent = stats.metricRow2 || '-';
  
  if (stats.isTimeLayer) {
    document.getElementById('avg-score').textContent = '-';
    document.getElementById('min-score').textContent = '-';
    document.getElementById('max-score').textContent = '-';
    document.getElementById('avg-percentile').textContent = formatValue(stats.avgTime, 1);
    document.getElementById('min-percentile').textContent = formatValue(stats.minTime, 1);
    document.getElementById('max-percentile').textContent = formatValue(stats.maxTime, 1);
  }
  else {
    document.getElementById('avg-score').textContent = '-';
    document.getElementById('min-score').textContent = '-';
    document.getElementById('max-score').textContent = '-';
    document.getElementById('avg-percentile').textContent = '-';
    document.getElementById('min-percentile').textContent = '-';
    document.getElementById('max-percentile').textContent = '-';
  }
}

function filterByJourneyTime(features, filterValue) {
  // console.log('filterByJourneyTime called from:');
  if (filterValue === '>30') {
    return features.filter(feature => {
      const coreid = feature.properties.COREID;
      const time = gridTimeMap[coreid];
      return time > 30;
    });
  } else {
    const [minRange, maxRange] = filterValue.split('-').map(parseFloat);
    return features.filter(feature => {
      const coreid = feature.properties.COREID;
      const time = gridTimeMap[coreid];
      return time >= minRange && (maxRange ? time <= maxRange : true);
    });
  }
}

function calculateWeightedAverage(values, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = values.reduce((sum, value, index) => sum + value * weights[index], 0);
  return weightedSum / totalWeight;
}

function getCurrentFeatures() {
  // console.log('getCurrentFeatures called from:');
  const filterType = filterTypeDropdown.value;
  
  let sourceFeatures = [];
  if (AmenitiesCatchmentLayer) {
    sourceFeatures = AmenitiesCatchmentLayer.toGeoJSON().features;
  } else if (grid) {
    sourceFeatures = grid.features;
  }
  
  return sourceFeatures;
}

function highlightSelectedArea() {
  // console.log('highlightSelectedArea called from:');
  const highlightAreaCheckbox = document.getElementById('highlightAreaCheckbox');
  if (!highlightAreaCheckbox.checked) {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
    return;
  }
  const filterType = filterTypeDropdown.value;
  
  const filterValueContainer = document.getElementById('filterValueContainer');
  if (!filterValueContainer) return;
  
  const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
    .map(checkbox => checkbox.value);
  
  if (selectedValues.length === 0) {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
    return;
  }

  let selectedPolygons = [];

  if (filterType === 'Ward') {
    if (!wardBoundariesLayer) return;
    
    selectedValues.forEach(filterValue => {
      const wardLayers = wardBoundariesLayer.getLayers().filter(layer => layer.feature.properties.WD24NM === filterValue);
      selectedPolygons = [...selectedPolygons, ...wardLayers.map(layer => layer.toGeoJSON())];
    });
  } else if (filterType === 'GrowthZone') {
    if (!GrowthZonesLayer) return;
    
    selectedValues.forEach(filterValue => {
      const growthZoneLayers = GrowthZonesLayer.getLayers().filter(layer => layer.feature.properties.Name === filterValue);
      selectedPolygons = [...selectedPolygons, ...growthZoneLayers.map(layer => layer.toGeoJSON())];
    });
  } else if (filterType === 'WestLinkZone') {
    if (!WestLinkZonesLayer) return;
    
    selectedValues.forEach(filterValue => {
      const WestLinkZoneLayers = WestLinkZonesLayer.getLayers().filter(layer => layer.feature.properties.name === filterValue);
      selectedPolygons = [...selectedPolygons, ...WestLinkZoneLayers.map(layer => layer.toGeoJSON())];
    });
  } else if (filterType === 'LA') {
    if (!uaBoundariesLayer) return;
    
    selectedValues.forEach(filterValue => {
      if (filterValue === 'MCA') {
        const mcaLayers = uaBoundariesLayer.getLayers().filter(layer => layer.feature.properties.LAD24NM !== 'North Somerset');
        selectedPolygons = [...selectedPolygons, ...mcaLayers.map(layer => layer.toGeoJSON())];
      } else if (filterValue === 'LEP') {
        const lepLayers = uaBoundariesLayer.getLayers();
        selectedPolygons = [...selectedPolygons, ...lepLayers.map(layer => layer.toGeoJSON())];
      } else {
        const uaLayers = uaBoundariesLayer.getLayers().filter(layer => layer.feature.properties.LAD24NM === filterValue);
        selectedPolygons = [...selectedPolygons, ...uaLayers.map(layer => layer.toGeoJSON())];
      }
    });
  }

  if (selectedPolygons.length > 0) {
    const unionPolygon = selectedPolygons.reduce((acc, polygon) => {
      return acc ? turf.union(acc, polygon) : polygon;
    }, null);

    const mapBounds = [-6.38, 49.87, 1.77, 55.81];
    const mapPolygon = turf.bboxPolygon(mapBounds);

    const inversePolygon = turf.difference(mapPolygon, unionPolygon);

    if (highlightLayer) {
      map.removeLayer(highlightLayer);
    }

    highlightLayer = L.geoJSON(inversePolygon, {
      style: {
        color: 'rgba(118,118,118,1)',
        weight: 1,
        fillColor: 'grey',
        fillOpacity: 0.75
      }
    }).addTo(map);
  }
}
