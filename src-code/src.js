// alert("hello world");
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';
// import { gsap } from "gsap";

const scene = new THREE.Scene();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const canvas = document.getElementById("experience-canvas");
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

// Audio Variables for Button Click Sound
let buttonSound = null;
let isAudioLoaded = false;


// Time Variables
let lightSchedule = {
  startTime: { hours: 8, minutes: 10 }, // Default start time 8:10 AM
  endTime: { hours: 23, minutes: 50 }   // Default end time 11:50 PM
};

// Optimal Range / Warning Thresholds
let warningThresholds = {
    tempHigh: 23.0,
    tempLow: 20.0,
    humidHigh: 75.0,
    humidLow: 62.0,
    co2High: 620.0,
    co2Low: 580.0,
    moistureHigh: 34.0,
    moistureLow: 30.0
};

let initialDelayPassed = false;

// Login functionality
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loadingScreen = document.getElementById('loadingScreen');
const enterButton = document.querySelector(".enter-button");
const loadingText = document.querySelector(".loading-text");
const instructions = document.querySelector(".instructions");

// Hardcoded credentials (for demo only - in production use secure authentication)
const validCredentials = {
  username: '123456',
  password: '123456'
};

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (username === validCredentials.username && password === validCredentials.password) {
    // Successful login
    initialDelayPassed = false; // Reset the delay flag
    loginError.classList.add('hidden');
    loginScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
  } else {
    // Failed login
    loginError.textContent = 'Invalid username or password';
    loginError.classList.remove('hidden');
  }
});

// Hide loading screen initially
loadingScreen.classList.add('hidden');

// Initialize chart variables
let dataChart = null;
const chartContainer = document.getElementById("chartContainer");
const closeChartButton = document.getElementById("closeChartButton");
const ctx = document.getElementById("dataChart").getContext("2d");

const LOG_PREFIX = '[FarmLab]';

let hoveredObject = null;
const hoverScaleFactor = 1.2; // How much to scale up on hover
const hoverAnimationDuration = 0.3; // Duration of the scale animation

// Chart The Data    
const sensorHistory = {
    temperature: [],
    humidity: [],
    moisture: [],
    soilEC: [],
    co2: [],
    atmosphericPress: [],
    poreEC: []
};

// Then modify your getData() function to store history
async function getData() {
    try {
        console.log(`${LOG_PREFIX} Fetching data from API...`);
        const response = await fetch("https://valk-huone-1.onrender.com/api/data");
        const data = await response.json();

        console.log(`${LOG_PREFIX} Raw API data:`, data);

        // Log camera data if available
        if (data.lastCameraShot) {
            console.log('Received camera data:', {
                id: data.lastCameraShot.id,
                timestamp: data.lastCameraShot.timestamp,
                imageUrl: data.lastCameraShot.imageUrl ? 'Available' : 'Not available'
            });
        } else {
            console.log('No camera data in response');
        }

        // Access historical data arrays
        if (data.tempHistory) {
            const tempValues = data.tempHistory.map(r => ({ time: r.time, value: r.value }));
            // console.log("Temperature History:", tempValues);
            
            // You can store this in your sensorHistory if needed
            sensorHistory.temperature = tempValues; // Keep all readings
        }
        if (data.humidityHistory) {
            const humidityValues = data.humidityHistory.map(r => ({ time: r.time, value: r.value }));
            // console.log("Humidity History:", humidityValues);
            
            // Store in sensorHistory
            sensorHistory.humidity = humidityValues;
        }
        if (data.co2History) {
            const co2Values = data.co2History.map(r => ({ time: r.time, value: r.value }));
            // console.log("CO2 History:", co2Values);
            
            // Store in sensorHistory
            sensorHistory.co2 = co2Values;
        }
        if (data.atmosphericPressHistory) {
            const atmosphericPressValues = data.atmosphericPressHistory.map(r => ({ time: r.time, value: r.value }));
            // console.log("Atmospheric Pressure History:", atmosphericPressValues);

            // Store in sensorHistory
            sensorHistory.atmosphericPress = atmosphericPressValues;
        }
        if (data.moistureHistory) {
            const moistureValues = data.moistureHistory.map(r => ({ time: r.time, value: r.value }));
            // console.log("Moisture History:", moistureValues);

            // Store in sensorHistory
            sensorHistory.moisture = moistureValues;
        }
        if (data.soilECHistory) {
            const soilECValues = data.soilECHistory.map(r => ({ time: r.time, value: r.value }));
            // console.log("Soil EC History:", soilECValues);

            // Store in sensorHistory
            sensorHistory.soilEC = soilECValues;
        }
        if (data.poreECHistory) {
            const poreECValues = data.poreECHistory.map(r => ({ time: r.time, value: r.value }));
            // console.log("Pore EC History:", poreECValues);

            // Store in sensorHistory
            sensorHistory.poreEC = poreECValues;
        }

        // Update visibility functions with delay logic
        if (initialDelayPassed) {
            updateTemperatureVisibility();
            updateCloudVisibility();
            updateMoistHighVisibility();
        } else {
            // Set timeout for initial delay
            setTimeout(() => {
                initialDelayPassed = true;
                updateTemperatureVisibility();
                updateCloudVisibility();
                updateMoistHighVisibility();
            }, 10000); // 10 seconds delay
        }

        // Access data from sensor1 (1061612) - likely has temperature and humidity
        const tempHumidityData = data.sensor1.readings || [];
        // Access data from sensor2 (6305245) - likely has moisture
        const moistureSoilECData = data.sensor2.readings || [];
        // Access data from sensor3 (3147479) - likely has moisture
        const AtmosphereCO2Data = data.sensor3.readings || [];
    
        // Extract values
        const temperatureReading = tempHumidityData.find(r => r.metric === "1");
        const humidityReading = tempHumidityData.find(r => r.metric === "2");
        const co2Reading = AtmosphereCO2Data.find(r => r.metric === "3");
        const atmosphericPressReading = AtmosphereCO2Data.find(r => r.metric === "4");
        const moistureReading = moistureSoilECData.find(r => r.metric === "8");
        const soilECReading = moistureSoilECData.find(r => r.metric === "10");
        const poreECReading = moistureSoilECData.find(r => r.metric === "11");

        console.log(`${LOG_PREFIX} Latest Sensor Readings:`);

        // Add new readings to history (keeping last 120 readings)

        if (temperatureReading) {
            const roundedTemp = parseFloat(temperatureReading.value).toFixed(1);
            console.log(`Temperature: ${roundedTemp}°C`);
            document.getElementById('temperature').textContent = roundedTemp;
            sensorHistory.temperature.push(roundedTemp);
            if (sensorHistory.temperature.length > 120) sensorHistory.temperature.shift();

            updateTemperatureVisibility();
            // Show/hide heat warning based on temperature
            const tempValue = parseFloat(roundedTemp);
            const heatWarningButton = document.getElementById('heatWarningButton');
            if (tempValue > warningThresholds.tempHigh || tempValue < warningThresholds.tempLow) {
                heatWarningButton.classList.remove('hidden');
                heatWarningButton.classList.add('visible', 'pulse');
            } else {
                heatWarningButton.classList.add('hidden');
                heatWarningButton.classList.remove('visible', 'pulse');
            }
        }

        if (humidityReading) {
            const roundedHumidity = parseFloat(humidityReading.value).toFixed(1);
            console.log(`Humidity: ${roundedHumidity}%`);
            document.getElementById('humidity').textContent = roundedHumidity;
            sensorHistory.humidity.push(roundedHumidity);
            if (sensorHistory.humidity.length > 120) sensorHistory.humidity.shift();

            // Show/hide humid warning based on humidity
            const humidValue = parseFloat(roundedHumidity);
            const humidWarningButton = document.getElementById('humidWarningButton');
            if (humidValue > warningThresholds.humidHigh || humidValue < warningThresholds.humidLow) {
                humidWarningButton.classList.remove('hidden');
                humidWarningButton.classList.add('visible', 'pulse');
            } else {
                humidWarningButton.classList.add('hidden');
                humidWarningButton.classList.remove('visible', 'pulse');
            }
        }

        if (moistureReading) {
            const roundedMoisture = parseFloat(moistureReading.value).toFixed(1);
            console.log(`Moisture: ${roundedMoisture}%`);
            document.getElementById('moisture').textContent = roundedMoisture;
            sensorHistory.moisture.push(roundedMoisture);
            if (sensorHistory.moisture.length > 120) sensorHistory.moisture.shift();

            updateMoistHighVisibility();

            // Show/hide moisture warning based on moisture
            const moistureValue = parseFloat(roundedMoisture);
            const moistureWarningButton = document.getElementById('moistureWarningButton');
            if (moistureValue > warningThresholds.moistureHigh || moistureValue < warningThresholds.moistureLow) {
                moistureWarningButton.classList.remove('hidden');
                moistureWarningButton.classList.add('visible', 'pulse');
            } else {
                moistureWarningButton.classList.add('hidden');
                moistureWarningButton.classList.remove('visible', 'pulse');
            }
        }

        if (soilECReading) {
            const roundedSoilEC = parseFloat(soilECReading.value).toFixed(3);
            console.log(`Soil EC: ${roundedSoilEC}mS/cm`);
            document.getElementById('soilEC').textContent = roundedSoilEC;
            sensorHistory.soilEC.push(roundedSoilEC);
            if (sensorHistory.soilEC.length > 120) sensorHistory.soilEC.shift();
        }

        if (co2Reading) {
            const roundedCO2 = parseFloat(co2Reading.value).toFixed(0);
            console.log(`CO2: ${roundedCO2}ppm`);
            document.getElementById('co2').textContent = roundedCO2;
            sensorHistory.co2.push(roundedCO2);
            if (sensorHistory.co2.length > 120) sensorHistory.co2.shift();

            updateCloudVisibility();

            // Show/hide co2 warning based on co2 level
            const co2Value = parseFloat(roundedCO2);
            const co2WarningButton = document.getElementById('co2WarningButton');
            if (co2Value > warningThresholds.co2High || co2Value < warningThresholds.co2Low) {
                co2WarningButton.classList.remove('hidden');
                co2WarningButton.classList.add('visible', 'pulse');
            } else {
                co2WarningButton.classList.add('hidden');
                co2WarningButton.classList.remove('visible', 'pulse');
            }
        }

        if (atmosphericPressReading) {
            const roundedAtmosphericPress = parseFloat(atmosphericPressReading.value).toFixed(0);
            console.log(`Atmospheric Pressure: ${roundedAtmosphericPress}hPa`);
            document.getElementById('atmosphericPress').textContent = roundedAtmosphericPress;
            sensorHistory.atmosphericPress.push(roundedAtmosphericPress);
            if (sensorHistory.atmosphericPress.length > 120) sensorHistory.atmosphericPress.shift();
        }
        if (poreECReading) {
            const roundedPoreEC = parseFloat(poreECReading.value).toFixed(3);
            console.log(`Pore EC: ${roundedPoreEC}mS/cm`);
            document.getElementById('poreEC').textContent = roundedPoreEC;
            sensorHistory.poreEC.push(roundedPoreEC);
            if (sensorHistory.poreEC.length > 120) sensorHistory.poreEC.shift();
        }

        // If chart is visible, update it
        if (dataChart && !chartContainer.classList.contains("hidden")) {
            const currentDataType = graphDataDropdown.value;
            if (currentDataType) {
                showChart(currentDataType);
            }
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

// Call immediately and then every 30 seconds
getData();
setInterval(getData, 30000); // 30000 ms = 30 seconds data fetch interval

async function fetchWarningThresholds() {
    try {
        const response = await fetch("https://valk-huone-1.onrender.com/api/warning-thresholds");
        if (!response.ok) throw new Error('Failed to fetch warning thresholds');
        
        const thresholds = await response.json();
        if (thresholds) {
            warningThresholds = {
                tempHigh: parseFloat(thresholds.temp_high),
                tempLow: parseFloat(thresholds.temp_low),
                humidHigh: parseFloat(thresholds.humid_high),
                humidLow: parseFloat(thresholds.humid_low),
                co2High: parseFloat(thresholds.co2_high),
                co2Low: parseFloat(thresholds.co2_low),
                moistureHigh: parseFloat(thresholds.moisture_high),
                moistureLow: parseFloat(thresholds.moisture_low)
            };
            console.log(`${LOG_PREFIX} Loaded warning thresholds`);
        }
    } catch (err) {
        console.error(`${LOG_PREFIX} Error fetching warning thresholds:`, err);
        // Fall back to default values if fetch fails
        warningThresholds = {
            tempHigh: 23.0,
            tempLow: 20.0,
            humidHigh: 75.0,
            humidLow: 62.0,
            co2High: 620.0,
            co2Low: 580.0,
            moistureHigh: 34.0,
            moistureLow: 30.0
        };
    }

}


const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize( sizes.width, sizes.height );
renderer.setPixelRatio(Math.min( window.devicePixelRatio, 2));
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

// let isModalOpen = false;

const modalContent = {
    CCTV: {
      title: "Thermal Camera View",
      content: "Live feed from the thermal camera",
      isCamera: true // Add this flag to identify camera modals
    },
    Pump: {
        title: "Watering Pump",
        content: "This is the Watering Pump, which is responsible for watering the plants inside the Lab. Above are the specifics of the pump.",
        image: "pumput.jpg"
    },
    Plate01: {
        title: "Contact Person",
        content: "Mark Johnson Panelo holds a Master’s degree in Computing in Construction from Metropolia University of Applied Sciences. For additional information, please refer to the link above.",
        link:"https://www.linkedin.com/in/mark-johnson-panelo-82030a325",
        image: "images/meCartoon.jpg",
    },
    Plate02: {
        title: "Strawberry Room",
        content: "This is Strawberry Room, the Digital Twin of Metropolia's UrbanFarmLab. A dynamic virtual representation that mirror physical form, condition and events inside the Lab. For more information about the UrbanFarmLab, visit the link above.",
        link:"https://www.metropolia.fi/en/rdi/collaboration-platforms/urbanfarmlab",
        image: "images/Teacher.jpg",
    },
};

const modal = document.querySelector(".modal");
const modalbgOverlay = document.querySelector(".modal-bg-overlay");
const modalTitle = document.querySelector(".modal-title");
const modalProjectDescription = document.querySelector(".modal-project-description");
const modalExitButton = document.querySelector(".modal-exit-button");
const modalVisitButton = document.querySelector(".modal-visit-button");


function showModal(id) {
    playButtonSound();
    // isModalOpen = true;
    const content = modalContent[id];
    if (content) {
        if (content.isCamera) {
            cameraToggleButton.click();
        } else {
            modalTitle.textContent = content.title;
            modalProjectDescription.innerHTML = content.content;

            // Remove existing styles
            modal.classList.remove("plate01-style", "plate02-style", "pump-style");

            // Apply custom class for Plate01 or Plate02
            if (id === "Plate01") {
                modal.classList.add("plate01-style");
            } else if (id === "Plate02") {
                modal.classList.add("plate02-style");
            } else if (id === "Plate02") {
                modal.classList.add("plate02-style");
            } else if (id === "Pump") {
                modal.classList.add("pump-style");
            }

            // Remove any existing image container first
            const existingImage = document.querySelector('.modal-image-container');
            if (existingImage) existingImage.remove();

            if (content.image) {
                const imageContainer = document.createElement('div');
                imageContainer.className = 'modal-image-container';
                imageContainer.innerHTML = `
                    <img src="${content.image}" alt="${content.title}" 
                         style="max-width: 500px; width: 100%; margin: 0 auto 20px; display: block;">
                `;
                modalProjectDescription.parentNode.insertBefore(imageContainer, modalProjectDescription);
            }

            if (content.link) {
                modalVisitButton.href = content.link;
                modalVisitButton.classList.remove("hidden");
            } else {
                modalVisitButton.classList.add("hidden");
            }

            modal.classList.remove("hidden");
            modalbgOverlay.classList.remove("hidden");
        }
    }
}


function hideModal(){
    // isModalOpen = false;
    modal.classList.toggle("hidden");
    modalbgOverlay.classList.add("hidden");
}

modalExitButton.addEventListener("click", function () {
    playButtonSound();
    hideModal();
});

// Time configuration functionality
const settingsButton = document.getElementById("settingsButton");
const settingsModal = document.querySelector(".settings-modal");
const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const settingsCloseButton = document.querySelector(".settings-close-button");

function closeSettingsModal() {
  // timeModal.classList.add("hidden");
  settingsModal.classList.add("hidden");
}

async function openSettingsModal() {
    // isModalOpen = true;
    try {
        // Show loading state
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'settings-loading';
        settingsModal.querySelector('.settings-modal-content').appendChild(loadingDiv);

        // Fetch all settings in parallel
        const [settingsResponse, thresholdsResponse, pumpResponse] = await Promise.all([
            fetch("https://valk-huone-1.onrender.com/api/light-schedule"),
            fetch("https://valk-huone-1.onrender.com/api/warning-thresholds"),
            fetch("https://valk-huone-1.onrender.com/api/pump-schedule")
        ]);
        
        if (!settingsResponse.ok || !thresholdsResponse.ok || !pumpResponse.ok) {
            throw new Error('Failed to fetch settings');
        }
        
        const lightSchedule = await settingsResponse.json();
        const warningThresholds = await thresholdsResponse.json();
        const pumpSchedule = await pumpResponse.json();
        
        // Format time helper function
        const formatTime = (hours, minutes) => 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Set light schedule values
        startTimeInput.value = formatTime(lightSchedule.start_hour, lightSchedule.start_minute);
        endTimeInput.value = formatTime(lightSchedule.end_hour, lightSchedule.end_minute);

        // Set pump schedule values
        if (pumpSchedule) {
            document.getElementById('firstIrrigationTime').value = 
                formatTime(pumpSchedule.first_irrigation_hour, pumpSchedule.first_irrigation_minute);
            document.getElementById('secondIrrigationTime').value = 
                formatTime(pumpSchedule.second_irrigation_hour, pumpSchedule.second_irrigation_minute);
            document.getElementById('pumpDuration').value = pumpSchedule.duration_seconds;
        }

        // Set threshold values
        document.getElementById('tempHigh').value = warningThresholds.temp_high;
        document.getElementById('tempLow').value = warningThresholds.temp_low;
        document.getElementById('humidHigh').value = warningThresholds.humid_high;
        document.getElementById('humidLow').value = warningThresholds.humid_low;
        document.getElementById('co2High').value = warningThresholds.co2_high;
        document.getElementById('co2Low').value = warningThresholds.co2_low;
        document.getElementById('moistureHigh').value = warningThresholds.moisture_high;
        document.getElementById('moistureLow').value = warningThresholds.moisture_low;

        // Remove loading state
        loadingDiv.remove();
        settingsModal.classList.remove("hidden");
    } catch (err) {
        console.error("Error fetching settings:", err);
        // Remove loading state even if there's an error
        if (loadingDiv) loadingDiv.remove();
        
        // Fall back to default values if fetch fails
        const formatTime = (hours, minutes) => 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        startTimeInput.value = formatTime(8, 10);
        endTimeInput.value = formatTime(23, 50);
        
        // Default pump schedule
        document.getElementById('firstIrrigationTime').value = '09:10';
        document.getElementById('secondIrrigationTime').value = '21:10';
        document.getElementById('pumpDuration').value = 60;
        
        // Default thresholds
        document.getElementById('tempHigh').value = 23.0;
        document.getElementById('tempLow').value = 20.0;
        document.getElementById('humidHigh').value = 75.0;
        document.getElementById('humidLow').value = 62.0;
        document.getElementById('co2High').value = 620;
        document.getElementById('co2Low').value = 580;
        document.getElementById('moistureHigh').value = 34.0;
        document.getElementById('moistureLow').value = 30.0;
        
        settingsModal.classList.remove("hidden");
        
        // Show error to user
        showWarning(
            "Settings Error", 
            "Failed to load current settings. Default values are shown."
        );
    }
}

async function fetchSettings() {
    try {
        const response = await fetch("https://valk-huone-1.onrender.com/api/settings");
        if (!response.ok) throw new Error('Failed to fetch settings');
        
        const settings = await response.json();
        if (settings) {
            if (settings.lightSchedule) {
                lightSchedule = {
                    startTime: { 
                        hours: settings.lightSchedule.start_hour, 
                        minutes: settings.lightSchedule.start_minute 
                    },
                    endTime: { 
                        hours: settings.lightSchedule.end_hour, 
                        minutes: settings.lightSchedule.end_minute 
                    }
                };
            }
            
            if (settings.warningThresholds) {
                warningThresholds = settings.warningThresholds;
            }
        }
    } catch (err) {
        console.error(`${LOG_PREFIX} Error fetching settings:`, err);
    }
}



async function saveSettings() {
    const [startHours, startMinutes] = startTimeInput.value.split(':').map(Number);
    const [endHours, endMinutes] = endTimeInput.value.split(':').map(Number);
    
    // Get pump schedule values
    const [firstHours, firstMinutes] = document.getElementById('firstIrrigationTime').value.split(':').map(Number);
    const [secondHours, secondMinutes] = document.getElementById('secondIrrigationTime').value.split(':').map(Number);
    const durationSeconds = parseInt(document.getElementById('pumpDuration').value);
    
    // Get threshold values
    warningThresholds = {
        tempHigh: parseFloat(document.getElementById('tempHigh').value),
        tempLow: parseFloat(document.getElementById('tempLow').value),
        humidHigh: parseFloat(document.getElementById('humidHigh').value),
        humidLow: parseFloat(document.getElementById('humidLow').value),
        co2High: parseFloat(document.getElementById('co2High').value),
        co2Low: parseFloat(document.getElementById('co2Low').value),
        moistureHigh: parseFloat(document.getElementById('moistureHigh').value),
        moistureLow: parseFloat(document.getElementById('moistureLow').value)
    };
    
    try {
        // Save all settings in parallel
        const [settingsResponse, pumpResponse] = await Promise.all([
            fetch("https://valk-huone-1.onrender.com/api/settings", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lightSchedule: {
                        startHour: startHours,
                        startMinute: startMinutes,
                        endHour: endHours,
                        endMinute: endMinutes
                    },
                    warningThresholds
                })
            }),
            fetch("https://valk-huone-1.onrender.com/api/pump-schedule", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstIrrigationHour: firstHours,
                    firstIrrigationMinute: firstMinutes,
                    secondIrrigationHour: secondHours,
                    secondIrrigationMinute: secondMinutes,
                    durationSeconds: durationSeconds
                })
            })
        ]);
        
        if (!settingsResponse.ok || !pumpResponse.ok) {
            const errorData = await settingsResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to save settings');
        }
        
        const [settingsResult, pumpResult] = await Promise.all([
            settingsResponse.json(),
            pumpResponse.json()
        ]);
        
        if (settingsResult.success && pumpResult) {
            lightSchedule = {
                startTime: { hours: startHours, minutes: startMinutes },
                endTime: { hours: endHours, minutes: endMinutes }
            };
            
            console.log(`${LOG_PREFIX} Settings updated`);
            closeSettingsModal();
            checkLightSchedule();
            updateCloudVisibility();
            updateMoistHighVisibility();
            updateTemperatureVisibility();
        } else {
            throw new Error(settingsResult.error || 'Failed to save settings');
        }
    } catch (err) {
        console.error(`${LOG_PREFIX} Error saving settings:`, err);
        showWarning(
            "Settings Error",
            `Failed to save settings: ${err.message}`
        );
    }
}

// Replace the existing settingsButton event listener with this:
settingsButton.addEventListener("click", function() {
    playButtonSound();
    
    // Check if autobot is ON
    if (deviceStates.autobot === "ON") {
        showWarning(
            "⚠️ Settings Locked", 
            "Switch to Manual mode first to reconfigure settings."
        );
        return; // Exit the function without opening settings
    }
    
    // If autobot is OFF, proceed to open settings
    openSettingsModal();
});
// settingsCloseButton.addEventListener("click", closeSettingsModal);
settingsCloseButton.addEventListener("click", () => {
    playButtonSound();
    closeSettingsModal();
});
saveSettingsButton.addEventListener("click", () => {
    playButtonSound();
    saveSettings();
});

// Raycaster
let intersectObject = "";
const intersectObjects = [];
const intersectObjectsNames = [
    "CCTV",
    "Pump",
    "Plate01",
    "Plate02",
    // "Thermometer",
    "StrawBerries1",
    "StrawBerries2",
    "StrawBerries3",
];


const manager = new THREE.LoadingManager();


// Hide loading text after 2 seconds and show welcome button
setTimeout(() => {
  gsap.to(loadingText, {
    opacity: 0,
    duration: 0.5,
    onComplete: () => {
      loadingText.style.display = 'none';
      
      // Show the welcome button after loading text disappears
      gsap.to(enterButton, {
        opacity: 1,
        duration: 1,
        delay: 0.3
      });
    }
  });
}, 8000);

// Update the manager.onLoad function
manager.onLoad = function () {
  // If models load before the 2-second timeout, ensure the button is shown
  if (loadingText.style.display !== 'none') {
    // Loading text is still visible, so we'll let the timeout handle the transition
    return;
  }
  
  // If loading text is already hidden, show the button immediately
  gsap.to(enterButton, {
    opacity: 1,
    duration: 1
  });
};


let exhaustFan = null;
let clockHandShort = null;
let clockHandLong = null;
let videoMesh = null;
let smokeParticles = [];
let smokeMaterial = null;
let video;

let pump = null;
let ccTV = null;
let monitor = null;
let screen = null;
let clock = null;
let strawBerries1 = null;
let strawBerries1_1 = null;
let strawBerries1_2 = null;
let strawBerries2 = null;
let strawBerries2_1 = null;
let strawBerries2_2 = null;
let strawBerries3 = null;
let strawBerries3_1 = null;
let strawBerries3_2 = null;
let signHolder = null;
let plate01 = null;
let plate02 = null;
let cloud = null;
let moistHigh = null;
let thermometer = null;
let tHigh = null;
let tLow = null;
let tNormal = null;


const loader = new GLTFLoader();

loader.load( 'model/FarmLab_WhiteRoom.glb', function ( glb ) {
  video = document.createElement('video');
  // video.src = 'SmartLab.mp4';
  video.src = 'video-sound/DigitalTwins2.mp4';
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.playsInline = true;
  video.autoplay = false;
  video.muted = true;
  video.volume = 0.2;
  video.load();

  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.flipY = false;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.format = THREE.RGBAFormat;

  // Create smoke emitters for Smoker1, Smoker2, Smoker3
  const smokerNames = ["Smoker1", "Smoker2", "Smoker3"];
  const smokeTexture = new THREE.TextureLoader().load('images/Smoke5.gif');
  smokeMaterial = new THREE.SpriteMaterial({
    map: smokeTexture,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  
  glb.scene.traverse((child) => {
    
    // Emit Smoke from Smoker1 - Smoker3
    if (smokerNames.includes(child.name)) {
      const smoker = child;

      for (let i = 0; i < 25; i++) {
        const sprite = new THREE.Sprite(smokeMaterial.clone());
        sprite.scale.set(0.6, 0.8, 0.6);
        sprite.position.set(
          smoker.position.x + (Math.random() - 0.5) * 0.5,
          smoker.position.y + Math.random() * -1,
          smoker.position.z + (Math.random() - 0.5) * 0.5
        );
        sprite.userData.origin = smoker.position.clone();
        sprite.visible = false;
        scene.add(sprite);
        smokeParticles.push(sprite);
      }
    }

    // For Intro  Animations
    if (child.name === "SignHolder") {
        signHolder = child;
        signHolder.visible = false;
        signHolder.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Plate01") {
        plate01 = child;
        plate01.visible = false;
        plate01.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Plate02") {
        plate02 = child;
        plate02.visible = false;
        plate02.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Monitor") {
        monitor = child;
        monitor.visible = false;
        monitor.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Screen") {    
        screen = child;
        screen.visible = false;
        screen.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Clock") {
        clock = child;
        clock.visible = false;
        clock.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Pump") {
        pump = child;
        pump.visible = false;
        pump.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "CCTV") {
        ccTV = child;
        ccTV.visible = false;
        ccTV.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Thermometer") {
        thermometer = child;
        thermometer.visible = false;
        thermometer.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "Cloud") {
        cloud = child;
        cloud.visible = false;
    }
    if (child.name === "MoistHigh") {
        moistHigh = child;
        moistHigh.visible = false;
    }
    if (child.name === "THigh") {
        tHigh = child;
        tHigh.visible = false;
    }
    if (child.name === "TLow") {
        tLow = child;
        tLow.visible = false;
    }
    if (child.name === "TNormal") {
        tNormal = child;
        tNormal.visible = false;
    }
    
    // Plays Video on Screen object
    if (child.name === "Screen") {
      child.material = new THREE.MeshBasicMaterial({ map: videoTexture });
      videoMesh = child;
      // video.play();
    }

    if (intersectObjectsNames.includes(child.name)) {
      intersectObjects.push(child);
    }

    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }

    // HIDE specific objects
    if (["ColdWind1", "ColdWind2", "WaterDrop01", "WaterDrop02"].includes(child.name)) {
      child.visible = false;
    }
    // For the animation of the water and cold wind
    if (child.name === "WaterDrop01") {
      water1 = child;
      water1.visible = false;
    }
    if (child.name === "WaterDrop02") {
      water2 = child;
      water2.visible = false;
    }

    if (child.name === "ColdWind1") {
      coldWind1 = child;
      coldWind1.visible = false;
    }
    if (child.name === "ColdWind2") {
      coldWind2 = child;
      coldWind2.visible = false;
    }

    // For the animation of Exhaust Fan and Clock
    if (child.name === "ExhaustFan") {
        exhaustFan = child;
        exhaustFan.visible = true; // Show the fan
        exhaustFan.scale.set(0, 0, 0); // Scale it down for better visibility
    }
    if (child.name === "ClockHandShort") {
        clockHandShort = child;
        clockHandShort.visible = false; // Hide initially
        clockHandShort.scale.set(0, 0, 0); // Start scaled down
    }
    if (child.name === "ClockHandLong") {
        clockHandLong = child;
        clockHandLong.visible = false; // Hide initially
        clockHandLong.scale.set(0, 0, 0); // Start scaled down
    }

  });
  scene.add( glb.scene );

}, undefined, function ( error ) {
  console.error( error );
} );

loader.load('model/Strawberries1a.glb', function(gltf) {
  const model1 = gltf.scene;
  model1.traverse((child) => {
      if (child.name === "StrawBerries1") {
        strawBerries1 = child;
        strawBerries1.visible = false;
        strawBerries1.scale.set(0, 0, 0); // Start scaled down
      }
      if (child.name === "StrawBerries1_1") {
        strawBerries1_1 = child;
        strawBerries1_1.visible = false;
        strawBerries1_1.scale.set(0, 0, 0); // Start scaled down
      }
      if (child.name === "StrawBerries1_2") {
        strawBerries1_2 = child;
        strawBerries1_2.visible = false;
      }
  });

  scene.add(model1);
});
loader.load('model/Strawberries2a.glb', function(gltf) {
  const model2 = gltf.scene;
  model2.traverse((child) => {
      if (child.name === "StrawBerries2") {
        strawBerries2 = child;
        strawBerries2.visible = false;
        strawBerries2.scale.set(0, 0, 0); // Start scaled down
      }
      if (child.name === "StrawBerries2_1") {
        strawBerries2_1 = child;
        strawBerries2_1.visible = false;
        strawBerries2_1.scale.set(0, 0, 0); // Start scaled down
      }
      if (child.name === "StrawBerries2_2") {
        strawBerries2_2 = child;
        strawBerries2_2.visible = false;
      }
  });
  scene.add(model2);
});
loader.load('model/Strawberries3a.glb', function(gltf) {
  const model3 = gltf.scene;
  model3.traverse((child) => {
      if (child.name === "StrawBerries3") {
        strawBerries3 = child;
        strawBerries3.visible = false;
        strawBerries3.scale.set(0, 0, 0); // Start scaled down
      }
      if (child.name === "StrawBerries3_1") {
        strawBerries3_1 = child;
        strawBerries3_1.visible = false;
        strawBerries3_1.scale.set(0, 0, 0); // Start scaled down
      }
      if (child.name === "StrawBerries3_2") {
        strawBerries3_2 = child;
        strawBerries3_2.visible = false;
      }
  });
  scene.add(model3);
});


const width = .2;
const height = 4.18;
const intensity = 25;

const width2 = .1;
const height2 = 1.43;
const intensity2 = 1;

const rectLight1 = new THREE.RectAreaLight(0xff69b4, intensity, width, height);
rectLight1.position.set(2.72, 5.61, .6);
rectLight1.lookAt(2.72, 0, .6);
rectLight1.intensity = 0;
rectLight1.visible = false;
scene.add(rectLight1);

const rectLightHelper1 = new RectAreaLightHelper(rectLight1);
rectLight1.add(rectLightHelper1);

const rectLight2 = new THREE.RectAreaLight(0xff69b4, intensity, width, height);
rectLight2.position.set(-1.45, 5.61, .6);
rectLight2.lookAt(-1.45, 0, .6);
rectLight2.intensity = 0;
rectLight2.visible = false;
scene.add(rectLight2);

const rectLightHelper2 = new RectAreaLightHelper(rectLight2);
rectLight2.add(rectLightHelper2);

const rectLight3 = new THREE.RectAreaLight(0xff69b4, intensity, width, height);
rectLight3.position.set(2.72, 7.61, .6);
rectLight3.lookAt(2.72, 0, .6);
rectLight3.intensity = 0;
rectLight3.visible = false;
scene.add(rectLight3);

const rectLightHelper3 = new RectAreaLightHelper(rectLight3);
rectLight3.add(rectLightHelper3);

const rectLight4 = new THREE.RectAreaLight(0xff69b4, intensity, width, height);
rectLight4.position.set(-1.45, 7.61, .6);
rectLight4.lookAt(-1.45, 0, .6);
rectLight4.intensity = 0;
rectLight4.visible = false;
scene.add(rectLight4);

const rectLightHelper4 = new RectAreaLightHelper(rectLight4);
rectLight4.add(rectLightHelper4);

const rectLight5 = new THREE.RectAreaLight(0xff69b4, intensity, width, height);
rectLight5.position.set(2.72, 3.61, .6);
rectLight5.lookAt(2.72, 0, .6);
rectLight5.intensity = 0;
rectLight5.visible = false;
scene.add(rectLight5);

const rectLightHelper5 = new RectAreaLightHelper(rectLight5);
rectLight5.add(rectLightHelper5);

const rectLight6 = new THREE.RectAreaLight(0xff69b4, intensity, width, height);
rectLight6.position.set(-1.45, 3.61, .6);
rectLight6.lookAt(-1.45, 0, .6);
rectLight6.intensity = 0;
rectLight6.visible = false;
scene.add(rectLight6);

const rectLightHelper6 = new RectAreaLightHelper(rectLight6);
rectLight6.add(rectLightHelper6);

const rectLight7 = new THREE.RectAreaLight(0xffffff, intensity2, width2, height2);
rectLight7.position.set(-3.65, 3.86, 5.2);
rectLight7.lookAt(-3.42, 0, 5.2);
rectLight7.rotation.z = THREE.MathUtils.degToRad(-20);
rectLight7.intensity = 0;
rectLight7.visible = false;
scene.add(rectLight7);

// const rectLightHelper7 = new RectAreaLightHelper(rectLight7);
// rectLight7.add(rectLightHelper7);

const rectLight8 = new THREE.RectAreaLight(0xffffff, intensity2, width2, height2);
rectLight8.position.set(-3.65, 2.57, 5.2);
rectLight8.lookAt(-3.42, 0, 5.2);
rectLight8.rotation.z = THREE.MathUtils.degToRad(-20);
rectLight8.intensity = 0;
rectLight8.visible = false;
scene.add(rectLight8);

// const rectLightHelper8 = new RectAreaLightHelper(rectLight8);
// rectLight8.add(rectLightHelper8);

const sun = new THREE.DirectionalLight( 0xFFFFFF );
sun.castShadow = true;
sun.position.set( 40, 40, 20 );
sun.target.position.set( 0, 0, 0 );
sun.shadow.mapSize.width = 4096;
sun.shadow.mapSize.height = 4096;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.normalBias = 0.2;
scene.add( sun );

const light = new THREE.AmbientLight( 0x404040, 4 );
scene.add( light );

const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 1000 );
camera.position.set(30.3, 12.4, 29.8); // <-- Initial position (X, Y, Z)
camera.lookAt(0, 4, 0); // <-- Where the camera is pointing (X, Y, Z)

const controls = new OrbitControls( camera, canvas );
controls.target.set(0, 4, 0);
controls.update();

// Animate objects growth on load
function animateObjectsGrowth() {
    const duration = 2; // Animation duration in seconds
    const ease = "elastic.out(3, 1.5)"; // Bouncy effect
    
    if (pump) {
        pump.visible = true;
        gsap.to(pump.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease
        });
    }
    if (monitor) {
        monitor.visible = true;
        gsap.to(monitor.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 0.5
        });
    }
    if (screen) {
        screen.visible = true;
        gsap.to(screen.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 0.5
        });
    }
    if (clock) {
        clock.visible = true;
        gsap.to(clock.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 1
        });
    }
    if (clockHandShort) {
        clockHandShort.visible = true;
        gsap.to(clockHandShort.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 1
        });
    }
    if (clockHandLong) {
        clockHandLong.visible = true;
        gsap.to(clockHandLong.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 1
        });
    }
    if (exhaustFan) {
        exhaustFan.visible = true;
        gsap.to(exhaustFan.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 1.5
        });
    }
    if (ccTV) {
        ccTV.visible = true;
        gsap.to(ccTV.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 2
        });
    }
    if (strawBerries1) {
        strawBerries1.visible = true;
        gsap.to(strawBerries1.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 2.3
        });
    }
    if (strawBerries1_1) {
        strawBerries1_1.visible = true;
        gsap.to(strawBerries1_1.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 2.3
        });
    }
    if (strawBerries2) {
        strawBerries2.visible = true;
        gsap.to(strawBerries2.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 2.6
        });
    }
    if (strawBerries2_1) {
        strawBerries2_1.visible = true;
        gsap.to(strawBerries2_1.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 2.6
        });
    }
    if (strawBerries3) {
        strawBerries3.visible = true;
        gsap.to(strawBerries3.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 2.9
        });
    }
    if (strawBerries3_1) {
        strawBerries3_1.visible = true;
        gsap.to(strawBerries3_1.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 2.9
        });
    }

    if (signHolder) {
        signHolder.visible = true;
        gsap.to(signHolder.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 3.2
        });
    }
    
    if (plate01) {
        plate01.visible = true;
        gsap.to(plate01.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 3.5 // Slight delay for staggered effect
        });
    }
    
    if (plate02) {
        plate02.visible = true;
        gsap.to(plate02.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 3.8 // Slight delay for staggered effect
        });
    }
    if (thermometer) {
        thermometer.visible = true;
        gsap.to(thermometer.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: duration,
            ease: ease,
            delay: 4.1 // Slight delay for staggered effect
        });
    }
}

function initAudio() {
    buttonSound = document.getElementById('buttonSound');

    // Set volume levels (0.0 to 1.0)
    buttonSound.volume = 0.6; // Adjust as needed
    
    buttonSound.addEventListener('canplaythrough', () => {
        isAudioLoaded = true;
    });
    
    buttonSound.addEventListener('error', () => {
        console.error("Error loading audio file");
    });
    
    // Preload the audio
    buttonSound.load();
}

// Add this function to play the sound
function playButtonSound() {
    if (isAudioLoaded && buttonSound) {
        buttonSound.currentTime = 0; // Reset to start
        buttonSound.play().catch(e => {
            console.log("Audio play failed:", e);
        });
    }
}

function onResize() {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    const aspect = sizes.width / sizes.height;
    camera.left = -aspect * 50;
    camera.right = aspect * 50;
    camera.top = 50;
    camera.bottom = -50;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min( window.devicePixelRatio, 2));
}

function onClick() {
  // if (isModalOpen) return;

  if(intersectObject !== ""){
      showModal(intersectObject);
  }
}


function onPointerMove(event) {

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(intersectObjects);
    
    // Reset previously hovered object
    if (hoveredObject) {
        gsap.to(hoveredObject.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: hoverAnimationDuration
        });
        hoveredObject = null;
    }
    
    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object.parent;
        const objectName = intersectedObject.name;
        
        // Only apply hover effect to specific objects
        if (["Plate01", "Plate02", "CCTV"].includes(objectName)) {
            document.body.style.cursor = 'pointer';
            hoveredObject = intersectedObject;
            
            // Animate scale up
            gsap.to(hoveredObject.scale, {
                x: hoverScaleFactor,
                y: hoverScaleFactor,
                z: hoverScaleFactor,
                duration: hoverAnimationDuration
            });
            
            intersectObject = objectName;
            return;
        }
    }
    
    // Default cursor if not hovering over our objects
    document.body.style.cursor = 'default';
    intersectObject = "";
}

modalbgOverlay.addEventListener("click", function() {
  playButtonSound();
    hideModal();
});
window.addEventListener("resize", onResize);
window.addEventListener("click", onClick);
window.addEventListener( "pointermove", onPointerMove );

function animate() {
  controls.maxDistance = 45;
  controls.minDistance = 11;
  controls.minPolarAngle = THREE.MathUtils.degToRad(35);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(90);
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(5);
  controls.maxAzimuthAngle = THREE.MathUtils.degToRad(80);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  if (controls.target.x > 5) controls.target.x = 5;
  if (controls.target.x < -4.5) controls.target.x = -4.5;
  if (controls.target.z > 5) controls.target.z = 5;
  if (controls.target.z < -4.5) controls.target.z = -4.5;
  if (controls.target.y > 8) controls.target.y = 8;
  if (controls.target.y < 2) controls.target.y = 2;

  // Update smoke particles (falling + spreading)
  if (isFanOn && smokeParticles.length > 0) {
    smokeParticles.forEach(p => {
      p.visible = true;
      p.position.y -= 0.02; // go downward instead of up
      p.position.x += (Math.random() - 0.5) * 0.002; // slight horizontal spread
      p.position.z += (Math.random() - 0.5) * 0.002;
      p.material.opacity -= 0.0015;

      if (p.material.opacity <= 0) {
        const origin = p.userData.origin;
        p.position.set(
          origin.x + (Math.random() - 0.5) * 0.5,
          origin.y - 1.5 + Math.random() * 2,
          origin.z + (Math.random() - 0.5) * 0.5
        );
        p.material.opacity = 0.2;
      }
    });
  } else {
    smokeParticles.forEach(p => {
      p.visible = false;
    });
  }

  controls.update();


  if (exhaustFan) {
    exhaustFan.rotation.y += 0.08;
  }
  if (clockHandShort) {
    clockHandShort.rotation.y -= 0.00001;
  }
  if (clockHandLong) {
    clockHandLong.rotation.y -= 0.0003;
  }

    renderer.render( scene, camera );
}

renderer.setAnimationLoop( animate );

let isFanOn = false;
let isPumpOn = false;
let isPlantLightOn = false;

let coldWind1 = null;
let coldWind2 = null;
let coldWindToggleInterval = null;
let water1 = null;
let water2 = null;
let waterToggleInterval = null;

let deviceStates = {
  fan: "OFF",
  plantLight: "OFF",
  pump: "OFF",
  autobot: "OFF"
};

async function fetchDeviceStates() {
  try {
    const response = await fetch("https://valk-huone-1.onrender.com/api/device-states");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    deviceStates = data;
    
    // Update button states based on fetched values
    updateButtonState(fanToggleButton, deviceStates.fan === "ON", "🌀ON", "🥵OFF");
    updateButtonState(plantLightToggleButton, deviceStates.plantLight === "ON", "💡ON", "🕯️OFF");
    updateButtonState(pumpToggleButton, deviceStates.pump === "ON", "🌧️ON", "🌵OFF");
    updateButtonState(autobotToggleButton, deviceStates.autobot === "ON", "🤖Auto", "👆Manual");
    
    // Set initial visibility of control buttons
    toggleControlButtonsVisibility(deviceStates.autobot === "ON");
    
    // Update actual device states
    isFanOn = deviceStates.fan === "ON";
    isPlantLightOn = deviceStates.plantLight === "ON";
    isPumpOn = deviceStates.pump === "ON";
    
    // Update visual states
    updateFanVisuals();
    updatePlantLightVisuals();
    updatePumpVisuals();

    // Start autobot interval if it's ON
    if (deviceStates.autobot === "ON") {
      startAutobotInterval();
    } else {
      stopAutobotInterval();
    }
    
  } catch (err) {
    console.error("Error fetching device states:", err);
  }
}

window.addEventListener('beforeunload', () => {
  stopAutobotInterval();
  stopLightScheduleCheck();
});

// Helper function to toggle control buttons visibility
function toggleControlButtonsVisibility(hideButtons) {
    if (pumpToggleButton && plantLightToggleButton) {
        if (hideButtons) {
            pumpToggleButton.style.display = 'none';
            plantLightToggleButton.style.display = 'none';
            fanToggleButton.style.display = 'none';
        } else {
            pumpToggleButton.style.display = '';
            plantLightToggleButton.style.display = '';
            fanToggleButton.style.display = '';
        }
    }
}


const autobotToggleButton = document.getElementById("autobotToggleButton");
let autobotInterval = null;
let lightScheduleInterval = null;
let isPumpRunning = false;

async function toggleAutobot() {
  const isAutobotOn = deviceStates.autobot === "ON";
  const newState = isAutobotOn ? "OFF" : "ON";
  
  // Check if autobot is being turned ON and show warning if settings haven't been configured
  if (newState === "ON") {
    // Check if default settings are still in place (indicating they haven't been configured)
    const isDefaultSettings = 
      lightSchedule.startTime.hours === 8 && 
      lightSchedule.startTime.minutes === 10 &&
      lightSchedule.endTime.hours === 23 && 
      lightSchedule.endTime.minutes === 50;
    
    if (isDefaultSettings) {
      showWarning(
        "⚠️ Configuration Required", 
        "Please reconfigure the settings first before enabling Auto mode."
      );
      return; // Don't proceed with turning on autobot
    }
  }
  
  try {
    await updateDeviceStateOnServer('autobot', newState);
    deviceStates.autobot = newState;
    updateButtonState(autobotToggleButton, !isAutobotOn, "🤖Auto", "👆Manual");
    
    // Toggle control buttons visibility
    toggleControlButtonsVisibility(newState === "ON");
    
    if (newState === "ON") {
      startAutobotInterval();
      startLightScheduleCheck();
      console.log("Autobot activated");
    } else {
      stopAutobotInterval();
      stopLightScheduleCheck();
      console.log("Autobot deactivated");
    }
  } catch (err) {
    console.error("Error updating autobot state:", err);
  }
}


function startLightScheduleCheck() {
  // Check immediately and then every minute
  checkLightSchedule();
  lightScheduleInterval = setInterval(checkLightSchedule, 30000); // Check every 30 seconds
}

function stopLightScheduleCheck() {
  if (lightScheduleInterval) {
    clearInterval(lightScheduleInterval);
    lightScheduleInterval = null;
  }
}

function startAutobotInterval() {
  // Check every 10 seconds (you can adjust this)
  autobotInterval = setInterval(checkPumpSchedule, 10000);
  // Also check immediately in case we're already at the right time
  checkPumpSchedule();
}

function stopAutobotInterval() {
  if (autobotInterval) {
    clearInterval(autobotInterval);
    autobotInterval = null;
  }
}


// Timer function to check light schedule
async function checkLightSchedule() {
  if (deviceStates.autobot !== "ON") return;
  
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // Convert current time to minutes since midnight for easier comparison
  const currentTimeInMinutes = hours * 60 + minutes;
  
  // Use the configurable schedule times
  const startTimeInMinutes = lightSchedule.startTime.hours * 60 + lightSchedule.startTime.minutes;
  const endTimeInMinutes = lightSchedule.endTime.hours * 60 + lightSchedule.endTime.minutes;
  
  // Determine if we should turn lights on or off
  let shouldLightsBeOn = false;
  
  if (endTimeInMinutes > startTimeInMinutes) {
    // Normal case (same day)
    shouldLightsBeOn = currentTimeInMinutes >= startTimeInMinutes && 
                       currentTimeInMinutes < endTimeInMinutes;
  } else {
    // Wrapping case (overnight)
    shouldLightsBeOn = currentTimeInMinutes >= startTimeInMinutes || 
                       currentTimeInMinutes < endTimeInMinutes;
  }
  
  // Only make changes if needed
  if (shouldLightsBeOn && !isPlantLightOn) {
    console.log(`${LOG_PREFIX} Turning plant lights ON (scheduled)`);
    await togglePlantLight();
  } else if (!shouldLightsBeOn && isPlantLightOn) {
    console.log(`${LOG_PREFIX} Turning plant lights OFF (scheduled)`);
    await togglePlantLight();
  }
}

// Fetch light schedule from server 
async function fetchLightSchedule() {
  try {
    const response = await fetch("https://valk-huone-1.onrender.com/api/light-schedule");
    if (!response.ok) throw new Error('Failed to fetch light schedule');
    
    const schedule = await response.json();
    if (schedule) {
      lightSchedule = {
        startTime: { hours: schedule.start_hour, minutes: schedule.start_minute },
        endTime: { hours: schedule.end_hour, minutes: schedule.end_minute }
      };
      console.log(`${LOG_PREFIX} Loaded light schedule: ${schedule.start_hour}:${schedule.start_minute} to ${schedule.end_hour}:${schedule.end_minute}`);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Error fetching light schedule:`, err);
  }
}


async function checkPumpSchedule() {
  if (deviceStates.autobot !== "ON" || isPumpRunning) return;
  
  try {
    // Fetch current pump schedule
    const response = await fetch("https://valk-huone-1.onrender.com/api/pump-schedule");
    if (!response.ok) throw new Error('Failed to fetch pump schedule');
    
    const schedule = await response.json();
    if (!schedule) return;
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    // Check first irrigation time
    if (hours === schedule.first_irrigation_hour && 
        minutes === schedule.first_irrigation_minute && 
        seconds === 0) {
      await runPumpForDuration(schedule.duration_seconds);
    }
    
    // Check second irrigation time
    if (hours === schedule.second_irrigation_hour && 
        minutes === schedule.second_irrigation_minute && 
        seconds === 0) {
      await runPumpForDuration(schedule.duration_seconds);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Error checking pump schedule:`, err);
  }
}

async function runPumpForDuration(durationSeconds) {
  if (isPumpRunning) return;
  
  isPumpRunning = true;
  const startTime = new Date();
  
  console.log(`${LOG_PREFIX} Starting pump at ${startTime.toISOString()} for ${durationSeconds} seconds`);
  
  try {
    // Turn pump ON
    await updateDeviceStateOnServer('pump', 'ON');
    deviceStates.pump = 'ON';
    isPumpOn = true;
    updateButtonState(pumpToggleButton, true, "🌧️ON", "🌵OFF");
    updatePumpVisuals();
    
    // Set timeout to turn pump OFF after duration
    setTimeout(async () => {
      try {
        await updateDeviceStateOnServer('pump', 'OFF');
        deviceStates.pump = 'OFF';
        isPumpOn = false;
        updateButtonState(pumpToggleButton, false, "🌧️ON", "🌵OFF");
        updatePumpVisuals();
        console.log(`${LOG_PREFIX} Pump turned OFF after scheduled duration at ${new Date().toISOString()}`);
      } catch (err) {
        console.error(`${LOG_PREFIX} Error turning pump OFF:`, err);
      } finally {
        isPumpRunning = false;
      }
    }, durationSeconds * 1000);
    
  } catch (err) {
    console.error(`${LOG_PREFIX} Error turning pump ON:`, err);
    isPumpRunning = false;
  }
}

// Add this event listener with your other event listeners
autobotToggleButton.addEventListener("click", function() {
  playButtonSound();
    toggleAutobot();
});

// Make sure to call fetchDeviceStates when the page loads

document.addEventListener('DOMContentLoaded', () => {
    fetchSettings();
    fetchDeviceStates();
    fetchWarningThresholds(); // Add this line
    initAudio(); // Initialize audio
});

// Set up periodic refresh every 5 seconds
const deviceStateInterval = setInterval(fetchDeviceStates, 5000);

window.addEventListener('beforeunload', () => {
  clearInterval(deviceStateInterval);
  stopAutobotInterval();
  stopLightScheduleCheck();
});

// Add these helper functions
function updateFanVisuals() {
  if (isFanOn) {
    let toggle = false;
    if (coldWindToggleInterval) clearInterval(coldWindToggleInterval);
    coldWindToggleInterval = setInterval(() => {
      if (coldWind1 && coldWind2) {
        toggle = !toggle;
        coldWind1.visible = toggle;
        coldWind2.visible = !toggle;
      }
    }, 500);
  } else {
    if (coldWindToggleInterval) clearInterval(coldWindToggleInterval);
    coldWindToggleInterval = null;
    if (coldWind1) coldWind1.visible = false;
    if (coldWind2) coldWind2.visible = false;
  }
}

function updatePlantLightVisuals() {
  const plantLights = [rectLight1, rectLight2, rectLight3, rectLight4, rectLight5, rectLight6];
  
  plantLights.forEach(light => {
    gsap.to(light, {
      intensity: isPlantLightOn ? 25 : 0,
      duration: 1
    });
    light.visible = isPlantLightOn;
  });
}


function updatePumpVisuals() {
  if (isPumpOn) {
    let toggle = false;
    if (waterToggleInterval) clearInterval(waterToggleInterval);
    waterToggleInterval = setInterval(() => {
      if (water1 && water2) {
        toggle = !toggle;
        water1.visible = toggle;
        water2.visible = !toggle;
      }
    }, 500);
  } else {
    if (waterToggleInterval) clearInterval(waterToggleInterval);
    waterToggleInterval = null;
    if (water1) water1.visible = false;
    if (water2) water2.visible = false;
  }
}

const fanToggleButton = document.getElementById("fanToggleButton");
const pumpToggleButton = document.getElementById("pumpToggleButton");
const plantLightToggleButton = document.getElementById("plantLightToggleButton");

function updateButtonState(button, isOn, onLabel, offLabel) {
  button.textContent = isOn ? onLabel : offLabel;
}

async function toggleFan() {
  isFanOn = !isFanOn;
  const newState = isFanOn ? "ON" : "OFF";
  updateButtonState(fanToggleButton, isFanOn, "🌀ON", "🥵OFF");
  updateFanVisuals();
  
  try {
    await updateDeviceStateOnServer('fan', newState);
  } catch (err) {
    console.error("Error updating fan state:", err);
    // Revert if update fails
    isFanOn = !isFanOn;
    updateButtonState(fanToggleButton, isFanOn, "🌀ON", "🥵OFF");
    updateFanVisuals();
  }
}

async function togglePlantLight(manualToggle = true) {
  // If this is an automatic toggle (from schedule), skip the server update
  if (!manualToggle) {
    isPlantLightOn = !isPlantLightOn;
    updateButtonState(plantLightToggleButton, isPlantLightOn, "💡ON", "🕯️OFF");
    updatePlantLightVisuals();
    return;
  }
  
  // Original manual toggle logic
  isPlantLightOn = !isPlantLightOn;
  const newState = isPlantLightOn ? "ON" : "OFF";
  updateButtonState(plantLightToggleButton, isPlantLightOn, "💡ON", "🕯️OFF");
  updatePlantLightVisuals();
  
  try {
    await updateDeviceStateOnServer('plantLight', newState);
  } catch (err) {
    console.error("Error updating plant light state:", err);
    // Revert if update fails
    isPlantLightOn = !isPlantLightOn;
    updateButtonState(plantLightToggleButton, isPlantLightOn, "💡ON", "🕯️OFF");
    updatePlantLightVisuals();
  }
}

async function togglePump() {
  isPumpOn = !isPumpOn;
  const newState = isPumpOn ? "ON" : "OFF";
  updateButtonState(pumpToggleButton, isPumpOn, "🌧️ON", "🌵OFF");
  updatePumpVisuals();
  
  try {
    await updateDeviceStateOnServer('pump', newState);
  } catch (err) {
    console.error("Error updating pump state:", err);
    // Revert if update fails
    isPumpOn = !isPumpOn;
    updateButtonState(pumpToggleButton, isPumpOn, "🌧️ON", "🌵OFF");
    updatePumpVisuals();
  }
}

async function updateDeviceStateOnServer(device, state) {
  const response = await fetch("https://valk-huone-1.onrender.com/api/update-device-state", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device, state })
  });
  
  if (!response.ok) {
    throw new Error('Failed to update device state');
  }
  
  return response.json();
}

// Button event listeners
fanToggleButton.addEventListener("click", function() {
  playButtonSound();
  toggleFan();
});
plantLightToggleButton.addEventListener("click", function() {
  playButtonSound();
  togglePlantLight();
});
pumpToggleButton.addEventListener("click", function() {
  playButtonSound();
  togglePump();
});

// Sound toggle
const soundToggleButton = document.getElementById("soundToggleButton");
let isSoundOn = true;
soundToggleButton.addEventListener("click", () => {
  playButtonSound();

  isSoundOn = !isSoundOn;
  soundToggleButton.textContent = isSoundOn ? '🔊' : '🔇';
  video.muted = !isSoundOn;
});

// Sun/dark mode toggle
const sunToggleButton = document.getElementById('sunToggleButton');
let isBright = true;

sunToggleButton.addEventListener('click', () => {
  playButtonSound();
  isBright = !isBright;
  sunToggleButton.textContent = isBright ? '🌞' : '🌚';

  // Control rectLight7 and rectLight8 (INVERSE LOGIC)
  const lightsOn = !isBright;
  const targetIntensity = lightsOn ? 5 : 0;
  gsap.to(rectLight7, {intensity: targetIntensity,duration: 1});
  gsap.to(rectLight8, {intensity: targetIntensity,duration: 1});
  rectLight7.visible = lightsOn;
  rectLight8.visible = lightsOn;

  gsap.to(light, { intensity: isBright ? 4 : 1, duration: 1 });
  gsap.to(sun, { intensity: isBright ? 1 : 0, duration: 1 });
  renderer.setClearColor(isBright ? 0xeeeeee : 0x111111, 1);

  const containers = [
    document.getElementById('location'),
    document.getElementById('outer-temperature'),
    document.getElementById('outer-humidity'),
    document.getElementById('outer-wind-speed'),
    document.getElementById('outer-feels-like'),
    document.getElementById('temperature-container'),
    document.getElementById('humidity-container'),
    document.getElementById('co2-container'),
    document.getElementById('atmosphericPress-container'),
    document.getElementById('moisture-container'),
    document.getElementById('soilElectroConductivity-container'),
    document.getElementById('poreElectroConductivity-container'),

    // document.getElementById('cameraToggleButton'),
    // document.getElementById('fanToggleButton'),
    // document.getElementById('plantLightToggleButton'),
    // document.getElementById('pumpToggleButton'),
    // document.getElementById('autobotToggleButton'),
  ];

  const newFontColor = isBright ? 'black' : 'white';
  containers.forEach(container => {
    if (container) {
      container.style.color = newFontColor;
    }
  });
});

// Initialize lights to correct state
rectLight7.intensity = isBright ? 0 : 1;
rectLight8.intensity = isBright ? 0 : 1;
rectLight7.visible = !isBright;
rectLight8.visible = !isBright;

// // Other Projects
// const otherProjectsButton = document.getElementById("otherProjectsButton");
const otherProjectsDropdown = document.getElementById("otherProjectsDropdown");

// // Other Projects dropdown functionality
otherProjectsDropdown.addEventListener("change", (event) => {
    playButtonSound();
    const selectedValue = event.target.value;
    if (selectedValue) {
        // Open the selected link in a new tab
        window.open(selectedValue, '_blank');
        // Close the dropdown
        // otherProjectsDropdown.classList.add("hidden");
        // Reset the dropdown to the default option
        otherProjectsDropdown.value = "";
    }
});

// Chart functionality
const graphDataButton = document.getElementById("graphDataButton");
const graphDataDropdown = document.getElementById("graphDataDropdown");

// Toggle dropdown visibility
graphDataButton.addEventListener("click", () => {
    playButtonSound();
    graphDataDropdown.classList.toggle("hidden");
});

// Update the dropdown event listener
graphDataDropdown.addEventListener("change", (event) => {
    const selectedValue = event.target.value;
    if (selectedValue) {
        showChart(selectedValue);
        graphDataDropdown.classList.add("hidden");
    }
});

// Close chart button
closeChartButton.addEventListener("click", () => {
    playButtonSound();
    chartContainer.classList.add("hidden");
});

function showChart(dataType) {
    if (dataChart) {
        dataChart.destroy();
    }

    let label, unit;
    
    switch(dataType) {
        case "temperature":
            label = "Temperature";
            unit = "°C";
            break;
        case "humidity":
            label = "Humidity";
            unit = "%";
            break;
        case "moisture":
            label = "Soil Moisture";
            unit = "%";
            break;
        case "soilEC":
            label = "Soil EC";
            unit = "mS/cm";
            break;
        case "co2":
            label = "CO2";
            unit = "ppm";
            break;
        case "atmosphericPress":
            label = "Atmospheric Pressure";
            unit = "hPa";
            break;
    }

    const labels = sensorHistory[dataType].map(entry => formatDateTimeForChart(new Date(entry.time)));

    dataChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${label} (${unit})`,
                data: sensorHistory[dataType].map(d => d.value),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${label}: ${context.parsed.y}${unit}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date and Time'
                    },
                    ticks: {
                        autoSkip: true,
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: `${label} (${unit})`
                    }
                }
            }
        }
    });

    chartContainer.classList.remove("hidden");
}

function formatDateTimeForChart(date) {
    const pad = (num) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Data download functionality
// Replace the current downloadToggleButton event listener and downloadData function with this:

const downloadToggleButton = document.getElementById("downloadToggleButton");
const downloadDataDropdown = document.getElementById("downloadDataDropdown");

// Toggle dropdown visibility
downloadToggleButton.addEventListener("click", () => {
    playButtonSound();
    downloadDataDropdown.classList.toggle("hidden");
});

// Handle dropdown selection
downloadDataDropdown.addEventListener("change", (event) => {
    const selectedValue = event.target.value;
    if (selectedValue) {
        downloadSelectedData(selectedValue);
        downloadDataDropdown.classList.add("hidden");
    }
});

function downloadSelectedData(dataType) {
    // downloadToggleButton.classList.add('saving');
    // downloadToggleButton.textContent = 'Saving...';

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").split('.')[0] + 'Z';
    const filename = `${dataType}_data_${timestamp}.xlsx`;
    
    // Get the selected data
    const selectedData = sensorHistory[dataType];
    
    if (!selectedData || selectedData.length === 0) {
        alert('No data available for download');
        // downloadToggleButton.classList.remove('saving');
        downloadToggleButton.textContent = '💾';
        return;
    }

    // Prepare headers based on data type
    let headers = [["Timestamp", `${getDataTypeLabel(dataType)} (${getDataUnit(dataType)})`]];
    
    // Prepare data rows
    const data = selectedData.map(entry => [
        entry.time ? formatDateTimeForExcel(new Date(entry.time)) : "",
        entry.value ?? ""
    ]);

    // Combine headers and data
    const excelData = [...headers, ...data];
    
    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${dataType} Data`);
    
    // Download the file
    XLSX.writeFile(wb, filename);

    setTimeout(() => {
        // downloadToggleButton.classList.remove('saving');
        downloadToggleButton.textContent = '💾';
    }, 2000);
}

// Helper functions to get labels and units
function getDataTypeLabel(dataType) {
    switch(dataType) {
        case "temperature": return "Temperature";
        case "humidity": return "Humidity";
        case "moisture": return "Soil Moisture";
        case "soilEC": return "Soil EC";
        case "co2": return "CO2";
        case "atmosphericPress": return "Atmospheric Pressure";
        case "poreEC": return "Pore EC";
        default: return dataType;
    }
}

function getDataUnit(dataType) {
    switch(dataType) {
        case "temperature": return "°C";
        case "humidity": 
        case "moisture": return "%";
        case "soilEC": 
        case "poreEC": return "mS/cm";
        case "co2": return "ppm";
        case "atmosphericPress": return "hPa";
        default: return "";
    }
}

function formatDateTimeForExcel(date) {
    const pad = num => num.toString().padStart(2, '0');
    
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}


// Camera functionality
const cameraToggleButton = document.getElementById("cameraToggleButton");
const cameraModal = document.createElement('div');
cameraModal.className = 'modal hidden';
cameraModal.innerHTML = `
  <div class="modal-wrapper">
    <div class="modal-header">
      <h1 class="modal-title">Thermal Camera View</h1>
      <button class="modal-exit-button">Exit</button>
    </div>
    <div class="modal-content">
      <div class="camera-container">
        <img id="camera-image" style="max-width: 100%;" />
        <div class="camera-info">
          <p>Time: <span id="camera-timestamp">${new Date().toLocaleString()}</span></p>
          <p>Temperature: <span id="camera-temperature"></span> °C</p>
          <p>Humidity: <span id="camera-humidity"></span> %</p>
        </div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(cameraModal);

function formatCurrentTime() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

cameraToggleButton.addEventListener("click", async () => {
  playButtonSound();
  // isModalOpen = true;
  try {
    document.getElementById('camera-timestamp').textContent = formatCurrentTime();
    
    cameraToggleButton.classList.add('loading');
    cameraToggleButton.textContent = 'Loading...';
    
    const response = await fetch("https://valk-huone-1.onrender.com/api/data");
    const data = await response.json();
    
    if (data.lastCameraShot && data.lastCameraShot.imageUrl) {
      document.getElementById('camera-image').src = data.lastCameraShot.imageUrl;
      
      if (data.sensor1 && data.sensor1.readings) {
        const tempReading = data.sensor1.readings.find(r => r.metric === "1");
        const humidReading = data.sensor1.readings.find(r => r.metric === "2");
        
        if (tempReading) {
          document.getElementById('camera-temperature').textContent = 
            parseFloat(tempReading.value).toFixed(1);
        }
        if (humidReading) {
          document.getElementById('camera-humidity').textContent = 
            parseFloat(humidReading.value).toFixed(1);
        }
      }
      
      cameraModal.classList.remove('hidden');
    } else {
      alert('No camera image available');
    }
  } catch (error) {
    console.error('Error fetching camera image:', error);
    alert('Failed to load camera image');
  } finally {
    cameraToggleButton.classList.remove('loading');
    cameraToggleButton.textContent = '🔥 Camera';
  }
});

cameraModal.querySelector('.modal-exit-button').addEventListener('click', () => {
  playButtonSound();
  // isModalOpen = false;
  cameraModal.classList.add('hidden');
});


enterButton.addEventListener("click", () => {
    playButtonSound();

    gsap.to(loadingScreen, {
        opacity: 0,
        duration: 1,
        onComplete: () => {
          
            loadingScreen.remove();
            document.getElementById("mainContent").style.display = "block";

            // Start growth animation after 500 milliseconds
            setTimeout(() => {
                animateObjectsGrowth();
            }, 500);
        },
    });
    video.muted = false;
    // video.load();
    video.play();
});

//Warning Alert, Message and Advisory

document.getElementById('heatWarningButton').addEventListener('click', () => {
  playButtonSound();
    const tempValue = parseFloat(document.getElementById('temperature').textContent);
    if (tempValue > warningThresholds.tempHigh) {
        showWarning(
            "⚠️ Warning (High Temperature)", 
            `The temperature level of the room is too high (${tempValue}°C > ${warningThresholds.tempHigh}°C)! If the situation persists, plants may experience heat stress.`
        );
    } else if (tempValue < warningThresholds.tempLow) {
        showWarning(
            "⚠️ Warning (Low Temperature)", 
            `The temperature level of the room is too low for optimal plant growth (${tempValue}°C < ${warningThresholds.tempLow}°C). If the situation persists, plants may experience cold stress.`
        );
    }
});
function updateTemperatureVisibility() {
    if (!initialDelayPassed) return;

    const tempValue = parseFloat(document.getElementById('temperature').textContent);
    if (thermometer) {
        if (tempValue > warningThresholds.tempHigh) {
            tHigh.visible = true;
            tLow.visible = false;
            tNormal.visible = false;
        } else if (tempValue < warningThresholds.tempLow) {
            tLow.visible = true;
            tHigh.visible = false;
            tNormal.visible = false;
        } else {
            tHigh.visible = false;
            tLow.visible = false;
            tNormal.visible = true;
        }
    }
}

document.getElementById('humidWarningButton').addEventListener('click', () => {
  playButtonSound();
    const humidValue = parseFloat(document.getElementById('humidity').textContent);
    if (humidValue > warningThresholds.humidHigh) {
        showWarning(
            "⚠️ Warning (High Humidity)", 
            `The humidity level of the room is too high (${humidValue}% > ${warningThresholds.humidHigh}%)! Turn on the dehumidifier or reduce water exposure.`
        );
    } else if (humidValue < warningThresholds.humidLow) {
        showWarning(
            "⚠️ Warning (Low Humidity)", 
            `The humidity level of the room is too low for optimal plant growth (${humidValue}% < ${warningThresholds.humidLow}%). Increase water exposure.`
        );
    }
});

document.getElementById('co2WarningButton').addEventListener('click', () => {
  playButtonSound();
    const co2Value = parseFloat(document.getElementById('co2').textContent);
    if (co2Value > warningThresholds.co2High) {
        showWarning(
            "⚠️ Warning (High CO2)", 
            `The CO2 level of the room is too high (${co2Value}ppm > ${warningThresholds.co2High}ppm)! If the situation persists, CO2 will build up.`
        );
    } else if (co2Value < warningThresholds.co2Low) {
        showWarning(
            "⚠️ Warning (Low CO2)", 
            `The CO2 level of the room is too low for optimal plant growth (${co2Value}ppm < ${warningThresholds.co2Low}ppm). Reduce ventilation.`
        );
    }
});
function updateCloudVisibility() {

    if (!initialDelayPassed) return;

    const co2Value = parseFloat(document.getElementById('co2').textContent);
    if (cloud) {
        if (co2Value > warningThresholds.co2High) {
            cloud.visible = true;
            // You might want to add some animation here
            gsap.to(cloud.scale, {
                x: 1.1,
                y: 1.1,
                z: 1.1,
                duration: 1,
                yoyo: true,
                repeat: -1
            });
        } else {
            cloud.visible = false;
            // Reset any animations
            gsap.killTweensOf(cloud.scale);
            cloud.scale.set(1, 1, 1);
        }
    }
}

document.getElementById('moistureWarningButton').addEventListener('click', () => {
  playButtonSound();
    const moistureValue = parseFloat(document.getElementById('moisture').textContent);
    if (moistureValue > warningThresholds.moistureHigh) {
        showWarning(
            "⚠️ Warning (High Moisture)", 
            `The moisture level of the soil is too high (${moistureValue}% > ${warningThresholds.moistureHigh}%)! If the situation persists, waterlogging may occur.`
        );
    } else if (moistureValue < warningThresholds.moistureLow) {
        showWarning(
            "⚠️ Warning (Low Moisture)", 
            `The moisture level of the soil is too low for optimal plant growth (${moistureValue}% < ${warningThresholds.moistureLow}%). If the situation persists, plants may wilt.`
        );
    }
});

function updateMoistHighVisibility() {

    if (!initialDelayPassed) return;

    const moistureValue = parseFloat(document.getElementById('moisture').textContent);
    if (moistHigh) {
        if (moistureValue > warningThresholds.moistureHigh) {
            moistHigh.visible = true;
            strawBerries1_1.visible = true;
            strawBerries2_1.visible = true;
            strawBerries3_1.visible = true;
            strawBerries1_2.visible = false;
            strawBerries2_2.visible = false;
            strawBerries3_2.visible = false;
        } else if (moistureValue < warningThresholds.moistureLow) {
            moistHigh.visible = false;
            strawBerries1_1.visible = false;
            strawBerries2_1.visible = false;
            strawBerries3_1.visible = false;
            strawBerries1_2.visible = true;
            strawBerries2_2.visible = true;
            strawBerries3_2.visible = true;
        } else {
            moistHigh.visible = false;
            strawBerries1_1.visible = true;
            strawBerries2_1.visible = true;
            strawBerries3_1.visible = true;
            strawBerries1_2.visible = false;
            strawBerries2_2.visible = false;
            strawBerries3_2.visible = false;
        }
    }
}

// This helper function to show the warning modal
function showWarning(title, message) {
    // isModalOpen = true;
    const warningModal = document.querySelector('.warning-modal');
    const warningTitle = document.getElementById('warning-title');
    const warningMessage = document.getElementById('warning-message');
    
    warningTitle.textContent = title;
    warningMessage.textContent = message;
    warningModal.classList.remove('hidden');
    
    // Close button functionality
    document.querySelector('.warning-close-button').addEventListener('click', () => {
        playButtonSound();
        // isModalOpen = false;
        warningModal.classList.add('hidden');
    }, { once: true }); // The event listener will be removed after first click
}
  
const weatherHeaders = {
    'Content-Type': 'application/json'
};

// Format the current date
function formatDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return now.toLocaleDateString('en-US', options);
}

// Update the date display
document.getElementById('current-date').textContent = formatDate();

// Function to update current Finland time
function updateFinlandTime() {
    const now = new Date();
    
    // Finland is in Eastern European Time (EET) UTC+2, or EEST UTC+3 during DST
    const options = {
        timeZone: 'Europe/Helsinki',
        hour12: false, // Use 24-hour format
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    
    // Format the time as HH:MM:SS
    const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
    
    // Update the time display
    document.getElementById('current-time').textContent = timeString;
}

// Update time immediately and then every second
updateFinlandTime();
setInterval(updateFinlandTime, 1000);

async function getWeather() {
    try {
        // Use the full backend URL instead of relative path
        const response = await fetch("https://valk-huone-1.onrender.com/api/weather");
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayWeather(data);
    } catch (error) {
        console.error('Weather fetch error:', error);
        displayError('Failed to load weather data. Please try again later.');
    }
}

function displayWeather(data) {
    const weatherContent = document.getElementById('weather-content');
            
    // Extract the relevant data from the response
    const condition = data.current.condition.text;
    const iconUrl = "https:" + data.current.condition.icon; // Add https: to make it a valid URL
    const temperature = Math.round(data.current.temp_c); // Temperature in Celsius
    const humidity = data.current.humidity;
    const windSpeed = data.current.wind_kph;
    const feelsLike = Math.round(data.current.feelslike_c);
            
    // Create the weather display HTML
    weatherContent.innerHTML = `
        <img src="${iconUrl}" alt="${condition}" class="weather-icon">
        <div id="outer-temperature" class="temperature">${temperature}°C</div>
        <div class="condition">${condition}</div>
        <div class="details">
            <div class="detail-item">
                <div class="detail-label">Humidity</div>
                <div id="outer-humidity" class="detail-value">${humidity}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Wind</div>
                <div id="outer-wind-speed" class="detail-value">${windSpeed} km/h</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Feels Like</div>
                <div id="outer-feels-like" class="detail-value">${feelsLike}°C</div>
            </div>
        </div>
    `;
}

function displayError(message) {
    const weatherContent = document.getElementById('weather-content');
    weatherContent.innerHTML = `
        <div class="error">
            <p>Failed to load weather data</p>
            
            <p>Try again later.</p>
        </div>
    `;
}

// Fetch weather data when page loads
getWeather();