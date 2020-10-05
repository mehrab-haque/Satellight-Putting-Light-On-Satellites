import React,{useState,createRef,useRef,useEffect,forwardRef, useImperativeHandle} from 'react'
import { getSatelliteInfo } from "tle.js";
import WorldWind from '@nasaworldwind/worldwind'
import {sat_data} from '../assets/master'

var wwd,timeDiff,textLayer,textAttributes,geoGraphicText,animator,interval,map,marker,infoWindow,polyLine,poly=[],tle,data,locationVar=null

const FPVView=forwardRef((props,ref)=>{
  if(props.location!=null)locationVar=props.location
  tle=[props.data.tle_line1,props.data.tle_line2]
  timeDiff=props.timeDiff
  var initData=getSatelliteInfo(tle,Date.now()+timeDiff,23.762397,90.418917)
  const containerRef=useRef()
  const [satCode,setSatCode]=useState(props.satCode)
  const [satData,setSatData]=useState(initData)
  const [timestamp,setTimestamp]=useState(Date.now()+timeDiff)
  const [location,setLocation]=useState(locationVar)

  useImperativeHandle(ref, () => ({
    setSatellite(sat){
      setSatData(sat.data)
      setSatCode(sat.satCode)
    },
    setTimeDiff(val){
      timeDiff=val
    },
    location(loc){
      setLocation(loc)
    }
 }));



  useEffect(()=>{
    WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);
    wwd = new WorldWind.WorldWindow(containerRef.current);
    animator=new WorldWind.GoToAnimator(wwd)
    var bMNGOneImageLayer = new WorldWind.BMNGOneImageLayer();
    var bMNGLayer=new WorldWind.BMNGLayer()
    var bMNGLandSatLayer=new WorldWind.BMNGLandsatLayer();
    var atmosphereLayer = new WorldWind.AtmosphereLayer(require('../assets/starfield.png'));

    var layers = [
        {layer:bMNGOneImageLayer,enabled:true},
        {layer:bMNGLayer,enabled:true},
        {layer:bMNGLandSatLayer,enabled:true},
        {layer:atmosphereLayer,enabled:true},
        {layer: new WorldWind.ViewControlsLayer(wwd), enabled: true}
    ];

    for (var l = 0; l < layers.length; l++) {
        layers[l].layer.enabled = layers[l].enabled;
        wwd.addLayer(layers[l].layer);
    }


    textAttributes= new WorldWind.TextAttributes(null)
    textAttributes.color = WorldWind.Color.GREEN;
    textAttributes.depthTest = false;
    textLayer = new WorldWind.RenderableLayer("Your Location")
    wwd.addLayer(textLayer)


        atmosphereLayer.time = Date.now()+timeDiff;
        function runSimulation() {
            atmosphereLayer.time = new Date(Date.now()+timeDiff)
            wwd.redraw();
            requestAnimationFrame(runSimulation);
        }
        requestAnimationFrame(runSimulation);
  },[])

  useEffect(()=>{
    if(location!=null){
      var peakPosition = new WorldWind.Position(location.lat, location.lng, 0)
      geoGraphicText=new WorldWind.GeographicText(peakPosition, 'Your Location')
      geoGraphicText.attributes = textAttributes
      textLayer.removeAllRenderables()
      textLayer.addRenderable(geoGraphicText)
    }
  },[location])

  useEffect(()=>{
    if(satCode) {
      interval = setInterval(() => {
        var currData=getSatelliteInfo(tle,Date.now()+timeDiff,23.762397,90.418917)
        wwd.goTo(new WorldWind.Position(currData.lat,currData.lng,currData.height*1000));
        setTimestamp(Date.now()+timeDiff)
        setSatData(currData)
      }, 100);
    } else {
      clearInterval(interval);
    }
  },[satCode])

  return(
    <div style={{width:'100%',height:'100%'}}>
      <div style={{color:'#00ff00',backgroundColor:'#00000088',position:'absolute',left:'50%',padding:'5px'}}>
        {sat_data[satCode].sat_name} {sat_data[satCode].country_name} {satData.lat!=null && satData.lat!=undefined?`Lat:${satData.lat.toFixed(3)} Lng:${satData.lng.toFixed(3)} Altitude:${satData.height.toFixed(3)}km Velocity:${satData.velocity.toFixed(3)}km/s ${new Date(timestamp).toLocaleString()}`:''}
      </div>
      <canvas ref={containerRef} className='globeBg' style={{ backgroundColor:'#000000',width: "100%", height: "100%" }}/>
    </div>
  )
})

export default FPVView
