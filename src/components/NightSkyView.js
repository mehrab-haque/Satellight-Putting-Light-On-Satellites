import React,{useState,createRef,useRef,useEffect,forwardRef, useImperativeHandle} from 'react'
import { getSatelliteInfo } from "tle.js";

function getNormalizedCoord(coord, zoom) {
        const y = coord.y;
        let x = coord.x;
        const tileRange = 1 << zoom;
        if (y < 0 || y >= tileRange) {
          return null;
        }
        if (x < 0 || x >= tileRange) {
          x = ((x % tileRange) + tileRange) % tileRange;
        }
        return {
          x: x,
          y: y
        };
      }

var posInterval,pathInterval,map,marker,infoWindow,polyLine,poly=[],tle,data

const NightSkyView=forwardRef((props,ref)=>{
  tle=[props.data.tle_line1,props.data.tle_line2]
  data=props.data
  const [satCode,setSatCode]=useState(props.satCode)
  const [timeDiff,setTimeDiff]=useState(props.timeDiff)
  const initialData=getSatelliteInfo(tle,Date.now()+timeDiff,0,0)
  const containerRef=useRef()


  useEffect(()=>{
    poly=[]
    map = new window.google.maps.Map(containerRef.current, {
      center: {
        lat: initialData.lat,
        lng: initialData.lng
      },
      zoom: 4,
      streetViewControl: false,
      mapTypeControlOptions: {
        mapTypeIds: ['Night Sky']
      }
    });

    const skyMapType = new window.google.maps.ImageMapType({
      getTileUrl: function(coord, zoom) {
        const normalizedCoord = getNormalizedCoord(coord, zoom);

        if (!normalizedCoord) {
          return "";
        }

        const bound = Math.pow(2, zoom);
        return (
          "https://mw1.google.com/mw-planetary/sky/skytiles_v1" +
          "/" +
          normalizedCoord.x +
          "_" +
          (bound - normalizedCoord.y - 1) +
          "_" +
          zoom +
          ".jpg"
        );
      },
      tileSize: new window.google.maps.Size(256, 256),
      maxZoom: 9,
      minZoom: 9,
      radius: 1738000,
      name: "Night Sky"
    });

    map.mapTypes.set("Night Sky", skyMapType);

    map.setMapTypeId("Night Sky");

    let iconMarker = new window.google.maps.MarkerImage(
                      data.icon_url,
                      null,
                      new window.google.maps.Point(0, 0), /* origin is 0,0 */
                      new window.google.maps.Point(30, 30), /* anchor is bottom center of the scaled image */
                      new window.google.maps.Size(60, 50)
                  );

     marker = new window.google.maps.Marker({
        position: map.center,
        icon:iconMarker,
        title:"Hello World!"
    });
    marker.setMap(map);

    infoWindow = new window.google.maps.InfoWindow({
      content: '<div>Hello World !!!</div>'
    });

    infoWindow.open(map, marker);

    polyLine= new window.google.maps.Polyline({
      path: poly,
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 1.0,
      strokeWeight: 4
    });

    polyLine.setMap(map)

  },[])

  useEffect(()=>{
    if(satCode) {
      posInterval = setInterval(() => {
        var currData=getSatelliteInfo(tle,Date.now()+timeDiff,0,0)
        marker.setPosition({
          lat:currData.lat,
          lng:currData.lng
        })

        var info=`<div>
            <center><span>${data.sat_name}</span></center>
            <center><img   height="30px" width='40px' src='${data.country_flag}'/></center>`+
            '<center>Lat:'+currData.lat.toFixed(3)+', Lng:'+currData.lng.toFixed(3)+'</center>'+
            '<center>Velocity:'+currData.velocity.toFixed(3)+'km/s <br/> Height:'+currData.height.toFixed(3)+'km</center>'+
            '</div>'

        infoWindow.setContent(info)

      }, 100);
      pathInterval = setInterval(() => {
        var currData=getSatelliteInfo(tle,Date.now()+timeDiff,0,0)
        poly.push(currData)
        polyLine.setPath(poly)
      }, 1000);
    } else {
      clearInterval(posInterval);
      clearInterval(pathInterval);
    }
  },[satCode])


  useImperativeHandle(ref, () => ({
    setSatellite(sat){
      data=sat.data
      tle=[sat.data.tle_line1,sat.data.tle_line2]
      poly=[]
      var currData=getSatelliteInfo(tle,Date.now()+timeDiff,0,0)
      var iconMarker = new window.google.maps.MarkerImage(
                        data.icon_url,
                        null,
                        new window.google.maps.Point(0, 0), /* origin is 0,0 */
                        new window.google.maps.Point(30, 30), /* anchor is bottom center of the scaled image */
                        new window.google.maps.Size(60, 50)
                    );
      marker.setIcon(iconMarker)
      map.panTo({
        lat:currData.lat,
        lng:currData.lng
      })
      setSatCode(sat.satCode)
    }
 }));



  useEffect(()=>{

  },[])

  return(
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}/>
  )
})

export default NightSkyView
