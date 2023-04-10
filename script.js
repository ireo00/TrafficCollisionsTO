/*--------------------------------------------------------------------
Step 1: INITIALIZE MAP
--------------------------------------------------------------------*/
//Define access token
mapboxgl.accessToken = 'pk.eyJ1IjoiaXJlbyIsImEiOiJjbGRtMTVrbGkwNHh5M3B0Yjd5YnF3cHNvIn0.KNtbmsY84dCZpXiXy91keg';


//Initialize map and edit to your preference
const map = new mapboxgl.Map({
    container: 'map', //container id in HTML
    style: 'mapbox://styles/ireo/clexqtt7g000401nq4snj99do',  // my map style URL
    center: [-79.35, 43.72],  // starting position [longitude, latitude]
    zoom: 10, // starting zoom level
    // define the max and min scrolling boundary for the map
    maxBounds: [
        [-79.8, 43.4], // Southwest coords
        [-78.8, 44]] // Northeast coords
});

/*ADDING MAPBOX CONTROLS AS ELEMENTS ON MAP*/
//Add zoom and navigation controls to the map.
map.addControl(new mapboxgl.NavigationControl());
//Add return to fullscreen button to the map.
map.addControl(new mapboxgl.FullscreenControl());

//Create geocoder variable
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    countries: "ca"
});

//Use geocoder div to position geocoder on page
document.getElementById('geocoder').appendChild(geocoder.onAdd(map));



/*--------------------------------------------------------------------
Step 2: VIEW GEOJSON POINT DATA ON MAP
--------------------------------------------------------------------*/
//HINT: Create an empty variable
//      Use the fetch method to access the GeoJSON from your online repository
//      Convert the response to JSON format and then store the response in your new variable
let collisgeojson;

// Fetch GeoJSON from URL and store response
fetch('https://raw.githubusercontent.com/ireo00/TrafficCollisionsTO/main/data/pedcyc_collision_06-21.geojson')
    .then(response => response.json())
    .then(response => {
        console.log(response); //Check response in console
        collisgeojson = response; // Store geojson as variable using URL from fetch response
    });



//Add data source and draw initial visiualization of layer
map.on('load', () => {
    /*--------------------------------------------------------------------
        Step 3: CREATE BOUNDING BOX AND HEXGRID
    --------------------------------------------------------------------*/
    //HINT: All code to create and view the hexgrid will go inside a map load event handler
    //      First create a bounding box around the collision point data then store as a feature collection variable
    //      Access and store the bounding box coordinates as an array variable
    //      Use bounding box coordinates as argument in the turf hexgrid function

    let bboxgeojson;
    let bbox = turf.envelope(collisgeojson); //send point geojson to turf, creates an 'envelope' (bounding box) around points
    let bboxscaled = turf.transformScale(bbox, 1.10);

    //put the resulting envelope in a geojson format FeatureCollection
    bboxgeojson = {
        "type": "FeatureCollection",
        "features": [bboxscaled]
    };


    //CREATE A HEX GRID
    //must be in order: minX, minY, maxX, maxY ... you have to pick these out from your envelope that you created previously
    let bboxcoords = [bboxscaled.geometry.coordinates[0][0][0],
    bboxscaled.geometry.coordinates[0][0][1],
    bboxscaled.geometry.coordinates[0][2][0],
    bboxscaled.geometry.coordinates[0][2][1]];
    let hexgeojson = turf.hexGrid(bboxcoords, 0.5, { units: 'kilometers' });


    console.log(collisgeojson)


    /*--------------------------------------------------------------------
    Step 4: AGGREGATE COLLISIONS BY HEXGRID
    --------------------------------------------------------------------*/
    //HINT: Use Turf collect function to collect all '_id' properties from the collision points data for each heaxagon
    //      View the collect output in the console. Where there are no intersecting points in polygons, arrays will be empty

    let collishex = turf.collect(hexgeojson, collisgeojson, '_id', 'values');
    console.log(collishex);


    //Count the number of features inside of each heaxagon, and also figure out the maximum value 
    let maxcollis = 0;

    collishex.features.forEach((feature) => {
        feature.properties.COUNT = feature.properties.values.length

        if (feature.properties.COUNT > maxcollis) {
            //console.log(feature);
            maxcollis = feature.properties.COUNT
        }
    });
    console.log(maxcollis);


    //Add datasource using GeoJSON variable
    //adding GeoJSON file of 'collisgeojson' for the collision points
    map.addSource('pedcyc-collis', {
        type: 'geojson',
        data: collisgeojson
    });

    map.addLayer({
        'id': 'pedcyc-collis-pnts',
        'type': 'circle',
        'source': 'pedcyc-collis',
        'paint': {
            'circle-radius': 5,
            'circle-color': '#134074', //#B6C4CC, #2DA9FE, #FB9B47, #D4A797
            'circle-opacity': 0.6
        }
    });

    //Creating pop-up for 'pedcyc-collis-pnts' layer
    map.on('mouseenter', 'pedcyc-collis-pnts', (e) => {
        map.getCanvas().style.cursor = 'pointer'; //Switch cursor to pointer when mouse is over collision points layer
    });

    map.on('mouseleave', 'pedcyc-collis-pnts', (e) => {
        map.getCanvas().style.cursor = ''; //Switch cursor back when mouse leaves collision points layer
        map.setFilter("to-bakeries", ['==', ['get', 'Name'], '']);
    });

    map.on('click', 'pedcyc-collis-pnts', (e) => {
        new mapboxgl.Popup() //Declare new popup object on each click
            .setLngLat(e.lngLat) //Use method to set coordinates of popup based on mouse click location
            .setHTML("Neighbourhood - " + e.features[0].properties.NEIGHBOURHOOD_158 +
                "<br>" + "Year: " + e.features[0].properties.YEAR)
            .addTo(map); //Show popup on map
    })

    //adding GeoJSON file of 'bboxgeojson' for the bounding box, the study area
    map.addSource('collis-bbox', {
        type: 'geojson',
        data: bboxgeojson //the bounding box that we just created
    });

    map.addLayer({
        'id': 'collis-box',
        'type': 'line',
        'source': 'collis-bbox',
        'paint': {
            'line-color': '#5B6B4B', //#EFCF88
            'line-width': 4,
            'line-opacity': 0.8
        }
    }, 'pedcyc-collis-pnts');


    //adding GeoJSON file of 'hexgeojson' for the hexgrid which contains the number of collisions per hexagon
    map.addSource('collis-hex', {
        type: 'geojson',
        data: hexgeojson //the hexgrid we previously created
    });

    map.addLayer({
        'id': 'hex-fill',
        'type': 'fill',
        'source': 'collis-hex',
        'paint': {
            'fill-color': [
                'step',
                //get value from property 'COUNT', the collision number per hexagon
                ['get', 'COUNT'],
                //assign color to any hexagons with count values <1
                '#F5F4EF', //F8FBFD
                //assign colors to hexagons with count values >=1
                1, '#FEDAB9', //DACAD2
                //assign colors to hexagons with count values >=4
                4, '#F8AD9D', //B08E9F
                //assign colors to hexagons with count values >=6
                6, '#F4978E', //93677D
                //assign colors to hexagons with count values >10
                10, '#F08080' //573D4A
            ],
            'fill-opacity': 0.8,
            'fill-outline-color': "white"
        }
    });

    //Add another visualization of the hexagon
    map.addLayer({
        'id': 'hex-outline', //Update id to represent highlighted layer
        'type': 'line',
        'source': 'hex-fill',
        'paint': {
            'line-color': '#bfdbf7',
            'line-opacity': 0.7,
            'line-outline-color': 'black'
        },
        'filter': ['==', ['get', 'COUNT'], '']
    });
});

//Creating pop-up for 'hex-fill' layer
map.on('mouseenter', 'hex-fill', () => {
    map.getCanvas().style.cursor = 'pointer'; //Switch cursor to pointer when mouse is over the hexagons layer
});

map.on('mouseleave', 'hex-fill', () => {
    map.getCanvas().style.cursor = '', //Switch cursor back when mouse leaves hexagons layer
    map.setFilter("hex-outline", ['==', ['get', 'COUNT'], ''])
});

map.on('click', 'hex-fill', (e) => {
    new mapboxgl.Popup() //Declare new popup object on each click
        .setLngLat(e.lngLat) //Use method to set coordinates of popup based on mouse click location
        .setHTML("Collision Count in Hexagon: " + e.features[0].properties.COUNT)
        .addTo(map); //Show popup on map
});

map.on('mousemove', 'hex-fill', (e) => {
    if (e.features.length > 0) { //if there are features in the event features array (i.e features under the mouse hover) then go into the conditional
        //set the filter of the hex-outline to display the feature you're hovering over
        //e.features[0] is the first feature in the array and properties.TRACT is the census tract number for that feature
        map.setFilter('hex-outline', ['==', ['get', 'COUNT'], e.features[0].properties.COUNT]);

    }
});

// /*--------------------------------------------------------------------
// Step 5: FINALIZE YOUR WEB MAP
// --------------------------------------------------------------------*/
//HINT: Think about the display of your data and usability of your web map.
//      Update the addlayer paint properties for your hexgrid using:
//        - an expression
//        - The COUNT attribute
//        - The maximum number of collisions found in a hexagon
//      Add a legend and additional functionality including pop-up windows
map.on('load', () => {

    //Change map layer display based on check box using setlayoutproperty
    //study area (box) layerdisplay based on check box
    document.getElementById('layercheck1').addEventListener('change', (e) => {
        map.setLayoutProperty(
            'pedcyc-collis-pnts',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        );
    });

    //hexagon grids layerdisplay based on check box
    document.getElementById('layercheck2').addEventListener('change', (e) => {
        map.setLayoutProperty(
            'hex-fill',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        );
    });

    //study area (box) layerdisplay based on check box
    document.getElementById('layercheck3').addEventListener('change', (e) => {
        map.setLayoutProperty(
            'collis-box',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        );
    });

});


//ADD INTERACTIVITY BASED ON HTML EVENT
//Add event listeneer which returns map view to full screen on button click
document.getElementById('returnbutton').addEventListener('click', () => {
    map.flyTo({
        center: [-79.35, 43.72],
        zoom: 10,
        essential: true
    });
});


//CREATING LEGEND FOR TORONTO COLLISION COUNT MAP
//Declare arrayy variables for labels and colours
const legendlabels = [
    '0',
    '1 - 3',
    '4 - 6',
    '>10'
];

const legendcolours = [
    '#F5F4EF',
    '#FEDAB9',
    '#F8AD9D',
    '#F4978E',
    '#F08080'
];

//Declare legend variable using legend div tag
const legend = document.getElementById('legend');

//For each layer create a block to put the colour and label in
legendlabels.forEach((label, i) => {
    const color = legendcolours[i];

    const item = document.createElement('div'); //each layer gets a 'row' - this isn't in the legend yet, we do this later
    const key = document.createElement('span'); //add a 'key' to the row. A key will be the color circle

    key.className = 'legend-key'; //the key will take on the shape and style properties defined in css
    key.style.backgroundColor = color; // the background color is retreived from teh layers array

    const value = document.createElement('span'); //add a value variable to the 'row' in the legend
    value.innerHTML = `${label}`; //give the value variable text based on the label

    //add 'key' (color cirlce) to the created section 'item' in the legend row
    item.appendChild(key);
    //add the 'value' to the legend row
    item.appendChild(value);
    //add 'item' to the legend
    legend.appendChild(item);
});

// Create a clicking function, where user can expand or close the legend by clicking the button (HTML element)
document.getElementById('legend-bar').addEventListener('click', (e) => {
    //if the legend is closed, expand it (i.e. change its display) and update the button label to 'close'
    if (document.getElementById('legend-bar').textContent === "Legend") {
        document.getElementById('legend-bar').innerHTML = "Close"
        legend.style.display = 'block';
    }
    //if the legend is expanded, close it (i.e. remove its display) and update the button label to 'expand'
    else if (document.getElementById('legend-bar').textContent === "Close") {
        document.getElementById('legend-bar').innerHTML = "Legend"
        legend.style.display = 'none';
    }
});

