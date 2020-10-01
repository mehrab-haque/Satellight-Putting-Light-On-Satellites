import React,{useState,createRef,useRef,useEffect,useLayoutEffect,forwardRef, useImperativeHandle} from 'react'
import { getSatelliteInfo } from "tle.js";
import Globe,{Point} from 'react-globe.gl';
import * as THREE from 'three'
import {sat_data} from '../assets/master'

const map = (value, x1, y1, x2, y2) => (value - x1) * (y2 - x2) / (y1 - x1) + x2;

var sat_arr=[]
Object.keys(sat_data).map((key,ind)=>{
  var data=sat_data[key]
  console.log(key)
  sat_arr.push(getSatelliteInfo([data.tle_line1,data.tle_line2],Date.now(),0,0,0))
})

  var point_arr=[],interval,currCode
  sat_arr.map((sat,ind)=>{
    var schema={
      lat:sat.lat,
      lng:sat.lng,
      alt:sat.height/6400,
      radius:map(sat.height,400,35000,3,12),
      height:sat.height,
      velocity:sat.velocity,
      color:'#000000',
      ind:ind
    }
    point_arr.push(schema)
  })

const ModelView=forwardRef((props,ref)=>{

  const [pointArr, setPointArr] = useState(point_arr);
  const [container,setContainer]=useState({height:0,width:0})
  const [satCode,setSatCode]=useState(props.satCode)
  const globeEl = useRef();
  currCode=props.satCode


  useImperativeHandle(ref, () => ({
    setSatellite(sat){
      setSatCode(sat.satCode)
    }
 }));



  useEffect(()=>{
    //globeEl.current.controls().autoRotate = true;
      //globeEl.current.controls().autoRotateSpeed = 0.2;
      console.log(props.parent.current.offsetWidth)
      setContainer({
        height:props.parent.current.offsetHeight,
        width:props.parent.current.offsetWidth
      })
  },[])

  useEffect(()=>{
    var defaultSat=Object.keys(sat_data).indexOf(satCode)
    globeEl.current.pointOfView({ lat:point_arr[defaultSat].lat,lng:point_arr[defaultSat].lng,altitude:pointArr[defaultSat].alt+1.2 },1000);
  },[satCode])

  useEffect(()=>{
    if(satCode) {
      interval = setInterval(() => {
        sat_arr=[]
        Object.keys(sat_data).map((key,ind)=>{
          var data=sat_data[key]
          sat_arr.push(getSatelliteInfo([data.tle_line1,data.tle_line2],Date.now(),23.762397,90.418917,0))
        })
        //console.log(satCode)
        point_arr=[]
        sat_arr.map((sat,ind)=>{
          var schema={
            lat:sat.lat,
            lng:sat.lng,
            alt:sat.height/6400,
            radius:map(sat.height,400,35000,2.5,6),
            height:sat.height,
            velocity:sat.velocity,
            color:'#000000',
            ind:ind
          }
          if(Object.keys(sat_data)[ind]==currCode){
            schema['color']='#ff0000'
            //console.log(Object.keys(sat_data)[ind]+' '+satCode)
          }
          point_arr.push(schema)
        })
        setPointArr(point_arr)
      }, 500);
    } else {
      clearInterval(interval);
    }
  },[satCode])

  return(

      <Globe

            showAtmosphere={false}
            backgroundColor='#ffffff'
            height={container.height}
            width={container.width}
            ref={globeEl}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"

            showGraticules={true}


            onCustomLayerHover={d=>{
                if(d!=null && d!=undefined){

                }
              }
          }

          onCustomLayerClick={d=>{
              if(d!=null && d!=undefined){

              }
            }
        }

        customLayerData={pointArr}
        customThreeObject={d =>{
          var mesh=new THREE.Mesh(
            new THREE.SphereBufferGeometry(d.radius),
            new THREE.MeshLambertMaterial({ color: d.color })
          )
          var group=new THREE.Group()
          group.add(mesh)
          return group
        }
      }
        customThreeObjectUpdate={(obj, d) => {
          Object.assign(obj.position, globeEl.current.getCoords(d.lat, d.lng, d.alt));
        }}
       />

  )
})

export default ModelView
