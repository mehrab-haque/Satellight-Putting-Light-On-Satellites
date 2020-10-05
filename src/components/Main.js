import React,{useState,useEffect,useRef} from 'react'
import{makeStyles,useTheme,Snackbar,Button,Dialog,DialogActions,DialogContent,DialogTitle,TextField,Avatar,Tooltip,Drawer,IconButton,Hidden,CssBaseline,AppBar,Toolbar,List,Typography,Divider,ListItem} from '@material-ui/core'
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import { deepOrange, deepPurple } from '@material-ui/core/colors';
import MenuIcon from '@material-ui/icons/Menu';
import ExploreIcon from '@material-ui/icons/Explore';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import SportsBaseballIcon from '@material-ui/icons/SportsBaseball';
import VisibilityIcon from '@material-ui/icons/Visibility';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import AccessAlarmsIcon from '@material-ui/icons/AccessAlarms';
import MessageIcon from '@material-ui/icons/Message';
import RoomIcon from '@material-ui/icons/Room';
import TrackChangesIcon from '@material-ui/icons/TrackChanges';
import Cookies from 'universal-cookie';
import * as firebase from 'firebase';
import {sat_data} from '../assets/master'
import MapView from './MapView'
import NightSkyView from './NightSkyView'
import ModelView from './ModelView'
import FPVView from './FPVView'
import { getSatelliteInfo } from "tle.js";

function toRad(Value)
{
    return Value * Math.PI / 180;
}

const COOKIE_AGE=31536000
const drawerWidth = 240;
const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex"
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  media: {
    height: 0,
    paddingTop: '56.25%', // 16:9
  },
  stepperRoot: {
    width: '100%',
  },
  canvasPaper: {
    padding: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: drawerWidth,
      flexShrink: 0,
    },
  },
  full:{
    width: drawerWidth-50
  },
  appBar: {
    [theme.breakpoints.up('sm')]: {
      width: `calc(100% - ${drawerWidth}px)`,
      height:'10vh',
      marginLeft: drawerWidth,
    },
  },
  menuButton: {
    marginRight: theme.spacing(2),
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  },
  toolbar: theme.mixins.toolbar,
  drawerPaper: {
    width: drawerWidth,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(0,0),
    height:'90vh'
  },
  root1:{
    height:'100%'
  },
  eliminationGrid : {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center"
  },
  orange: {
    color: theme.palette.getContrastText(deepOrange[500]),
    backgroundColor: deepOrange[500],
  },
  purple: {
    color: theme.palette.getContrastText(deepPurple[500]),
    backgroundColor: deepPurple[500],
  }
}));

var sat_codes=Object.keys(sat_data)
var tokenObject={}
function splitMulti(string, tokens){
  var str=string.toLowerCase()
        var tempChar = tokens[0];
        for(var i = 1; i < tokens.length; i++){
            str = str.split(tokens[i]).join(tempChar);
        }
        str = str.split(tempChar);
        return str;
}
sat_codes.map(code=>{
  var sat=sat_data[code]
  var tokens=''
  tokens+=code
  splitMulti(sat.type,[' ',',','.']).map(token=>{
    tokens+=token.trim()
  })
  splitMulti(sat.country_name,[' ',',','.']).map(token=>{
    tokens+=token.trim()
  })
  splitMulti(sat.launch_date,[' ',',','.']).map(token=>{
    tokens+=token.trim()
  })

  splitMulti(sat.name,[' ',',','.']).map(token=>{
    tokens+=token.trim()
  })
  splitMulti(sat.sat_name,[' ',',','.']).map(token=>{
    tokens+=token.trim()
  })
  if('isGeoStationary' in sat && sat.isGeoStationary)
    tokens+='geostationary'

  tokenObject[code]=tokens
})


var canvasDim=250,cookies = new Cookies(),isCookied=true,interval,defaultSatCode='25544',commentsRef=null,startup=true
if(cookies.get('intro')==undefined || cookies.get('intro')==null)isCookied=false


const Main=props=>{
  const { window } = props;
  const classes = useStyles();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notification,setNotification]=useState(false)
  const [message,setMessage]=useState('')
  const [mode, setMode] = useState('map');
  const [time,setTime]=useState('live')
  const [satellite,setSatellite]=useState(defaultSatCode)
  const [searchFilter,setSearchFilter]=useState(sat_data)
  const [timeDialog,setTimeDialog]=useState(false)
  const [desDialog,setDesDialog]=useState(false)
  const [timeDiff,setTimeDiff]=useState(0)
  const [video,setVideo]=useState(!isCookied)
  const [social,setSocial]=useState(false)
  const [developer,setDeveloper]=useState(false)
  const [comments,setComments]=useState(false)
  const [addComment,setAddComment]=useState(false)
  const [location,setLocation]=useState(null)
  const [commentsData,setCommentsData]=useState({})
  const [stats,setStats]=useState({})
  const [finder,setFinder]=useState(false)
  const [satData,setSatData]=useState(null)

  const viewRef=useRef()
  const containerRef=useRef()
  const timeRef=useRef()
  const commentRef=useRef()
  const nameRef=useRef()
  const hRef=useRef()
  const vRef=useRef()

  const notify=message=>{
    setMessage(message)
    setNotification(true)
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMode = (event, newMode) => {
    if(newMode!=null)
      setMode(newMode);
  };

  const handleTime = (event, newTime) => {
    if(newTime!=null)
      setTime(newTime);
  };

  const fpv=()=>{
    setMode('fpv')
  }

  const modelSatClick=code=>{
    setSatellite(code)
    setDesDialog(true)
  }

  const gotoTimeLine=()=>{
    var timeDiffTmp=new Date(timeRef.current.value).getTime()-Date.now()
    viewRef.current.setTimeDiff(timeDiffTmp)
    setTimeDiff(timeDiffTmp)
    setTimeDialog(false)
  }

  useEffect(()=>{
    if(!video && !startup){
      setSocial(true)
    }
  },[video])

  useEffect(()=>{
    startup=false
    firebase.firestore().collection('satellight').doc('stats').onSnapshot(docSnapshot => {
      setStats(docSnapshot.data())
    }, err => {
      console.log(err);
    })
    navigator.geolocation.getCurrentPosition(function(position) {
      setLocation({
        lat:position.coords.latitude,
        lng:position.coords.longitude
      })
    });
  },[])

  const countView=code=>{
    firebase.firestore().collection('satellight').doc('stats').update({
      [code+'_v']:firebase.firestore.FieldValue.increment(1)
    })
  }

  const countComment=code=>{
    firebase.firestore().collection('satellight').doc('stats').update({
      [code+'_c']:firebase.firestore.FieldValue.increment(1)
    })
  }
  useEffect(()=>{
    if(time=='other')
      setTimeDialog(true)
    else if(time=='live'){
      setTimeDiff(0)
      viewRef.current.setTimeDiff(0)
    }
  },[time])

  const setCookie=()=>{
    cookies.set('intro',true,{ path: '/', maxAge: COOKIE_AGE })
  }

  useEffect(()=>{
    if(!comments && commentsRef!=null)
      commentsRef.off()
  },[comments])

  const loadComments=code=>{
    commentsRef=firebase.database().ref().child('comments').child(code)
    commentsRef.on('value', function(snapshot) {
      if(snapshot.val()!=null)setCommentsData(snapshot.val())
      else setCommentsData({})
    });
    setComments(true)
  }

  const postComment=()=>{
    var name=nameRef.current.value.trim()
    var comment=commentRef.current.value.trim()
    if(name.length==0 || comment.length==0)
      notify('Fields can\'t be empty.')
    else{
      setAddComment(false)
      commentsRef.push().set({
        name:name,
        comment:comment,
        timestamp:Date.now()
      }).then(()=>{
        notify('Comment added')
        countComment(satellite)
      }).catch(err=>{
        notify(err.message)
      })
    }
  }

  const filter=e=>{
    var keywords=splitMulti(e.target.value,[' ',',','.'])
    var filteredList={}
    var keys=Object.keys(tokenObject)
    keys.map(key=>{
      var isMatched=false
      var token=''
      keywords.map(keyword=>{
        token+=keyword
      })
      if(tokenObject[key].includes(token))
        filteredList[key]=sat_data[key]
    })
    setSearchFilter(filteredList)

  }

  useEffect(()=>{
    if((location!=null)){
      viewRef.current.location(location)
    }
  },[location])

  useEffect(()=>{
    if(finder) {
      interval= setInterval(() => {
        if(satellite!=null && location!=null){
          var sat=sat_data[satellite]
          var tle=[sat.tle_line1,sat.tle_line2]
          var info=getSatelliteInfo(tle,Date.now()+timeDiff,location.lat,location.lng,0)
          setSatData(info)
          console.log(info)

          var ctx1 = hRef.current.getContext("2d");
          ctx1.clearRect(0, 0, canvasDim,canvasDim);

          ctx1.beginPath()
          ctx1.strokeStyle = "#000000";
          ctx1.moveTo(canvasDim/2, canvasDim/2);
          ctx1.lineTo(canvasDim/2,canvasDim);
          ctx1.moveTo(canvasDim/2, canvasDim/2);
          ctx1.lineTo(canvasDim/2, 0);
          ctx1.moveTo(canvasDim/2, canvasDim/2);
          ctx1.lineTo(canvasDim, canvasDim/2);
          ctx1.moveTo(canvasDim/2, canvasDim/2);
          ctx1.lineTo(0, canvasDim/2);
          //ctx1.lineTo()

          ctx1.font = "20px Arial";
          ctx1.fillText("N", canvasDim/2+5, 20);
          ctx1.fillText("S", canvasDim/2+5, canvasDim);
          ctx1.fillText("W", 0, canvasDim/2-5);
          ctx1.fillText("E", canvasDim-20, canvasDim/2-5);

          ctx1.fill()

          ctx1.stroke();
          ctx1.beginPath()
          ctx1.moveTo(canvasDim/2, canvasDim/2);
          ctx1.strokeStyle = "#00aa00";
          var hAngle=info.azimuth-90
          var hX=Math.cos(hAngle*Math.PI/180)*canvasDim/2
          var hY=Math.sin(hAngle*Math.PI/180)*canvasDim/2
          ctx1.lineTo(hX+canvasDim/2,hY+canvasDim/2);
          ctx1.stroke()



          var ctx2 = vRef.current.getContext("2d");
          ctx2.clearRect(0, 0, canvasDim,canvasDim);

          ctx2.beginPath()
          ctx2.strokeStyle = "#000000";
          ctx2.moveTo(canvasDim/2, canvasDim/2);
          ctx2.lineTo(canvasDim/2,canvasDim);
          ctx2.moveTo(canvasDim/2, canvasDim/2);
          ctx2.lineTo(canvasDim/2, 0);
          ctx2.moveTo(canvasDim/2, canvasDim/2);
          ctx2.lineTo(canvasDim, canvasDim/2);
          ctx2.moveTo(canvasDim/2, canvasDim/2);
          ctx2.lineTo(0, canvasDim/2);
          //ctx1.lineTo()

          ctx2.font = "20px Arial";
          ctx2.fillText("Above Head", canvasDim/2+5, 20);
          ctx2.fillText("Below Feet", canvasDim/2+5, canvasDim);
          ctx2.fillText("Horizontal", 0, canvasDim/2-5);

          ctx2.fill()

          ctx2.stroke();
          ctx2.beginPath()
          ctx2.moveTo(canvasDim/2, canvasDim/2);
          ctx2.strokeStyle = "#00aa00";
          var vAngle=-info.elevation
          var vX=Math.cos(vAngle*Math.PI/180)*canvasDim/2
          var vY=Math.sin(vAngle*Math.PI/180)*canvasDim/2
          ctx2.lineTo(vX+canvasDim/2,vY+canvasDim/2);
          ctx2.stroke()


        }
      }, 200);
    } else {
      clearInterval(interval);
    }
  },[finder])


  const closestSat=()=>{
    navigator.geolocation.getCurrentPosition(function(position) {
      setLocation({
        lat:position.coords.latitude,
        lng:position.coords.longitude
      })
    });
    if(location!=null){
      var min=1000000000,minCode
      Object.keys(sat_data).map(code=>{
        var sat=sat_data[code]
        var tle=[sat.tle_line1,sat.tle_line2]
        var info=getSatelliteInfo(tle,Date.now()+timeDiff,location.lat,location.lng,0)
        if(info.range<min){
          min=info.range
          minCode=code
        }
      })
      setSatellite(minCode)
    }
  }

  const showDirection=()=>{
    navigator.geolocation.getCurrentPosition(function(position) {
      setLocation({
        lat:position.coords.latitude,
        lng:position.coords.longitude
      })
    });
    if(location!=null)setFinder(true)
  }

  useEffect(()=>{
    viewRef.current.setSatellite({
      satCode:satellite,
      data:sat_data[satellite]
    })
    countView(satellite)
  },[satellite])

  const container = window !== undefined ? () => window().document.body : undefined;
  const drawer=(
    <div className='explorer'>
    <center>

    <Button style={{marginTop:'10px'}} onClick={()=>{setVideo(true)}} variant='outlined' color="secondary">
      Usage
    </Button>
    <Button  style={{marginTop:'10px',marginLeft:'5px'}} onClick={()=>{setDeveloper(true)}} variant='outlined' color="primary">
      Developer
    </Button>

      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleMode}
        aria-label="text alignment"
        style={{marginTop:'10px'}}
      >
          <ToggleButton value="map" aria-label="left aligned">
            <Tooltip title="Map View">
              <ExploreIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="night" aria-label="centered">
            <Tooltip title="Night Sky View">
              <Brightness4Icon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="3d" aria-label="right aligned">
            <Tooltip title="3D Model View">
              <SportsBaseballIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="fpv" aria-label="justified">
            <Tooltip title="First Person View">
              <VisibilityIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>


        <ToggleButtonGroup
          value={time}
          exclusive
          onChange={handleTime}
          aria-label="text alignment"
          style={{marginTop:'5px'}}
        >
        <ToggleButton value="live" aria-label="left aligned">
          <Tooltip title="Live">
            <CheckCircleIcon/>
          </Tooltip>
        </ToggleButton>
        <ToggleButton onClick={()=>{setTimeDialog(true)}} value="other" aria-label="left aligned">
          <Tooltip title="Past/Future">
            <AccessAlarmsIcon/>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      <ToggleButton style={{marginTop:'-16px'}} onClick={showDirection} value="other" aria-label="left aligned">
        <Tooltip title="Where to look at to see the selected satellite from your location">
          <TrackChangesIcon/>
        </Tooltip>
      </ToggleButton>
      <ToggleButton style={{marginTop:'-16px'}} onClick={closestSat} value="other" aria-label="left aligned">
        <Tooltip title="Closest satellite from your location on selected timeline">
          <RoomIcon/>
        </Tooltip>
      </ToggleButton>
      <br/>

        <TextField style={{marginTop:'5px'}} onChange={filter} id="outlined-basic" label="Search" variant="outlined" />
      </center>
      <List>
        {
          Object.keys(searchFilter).map((key,ind)=>{
            var sat=searchFilter[key]
            return(
              <div>
                <Divider />
                <Divider />
                <ListItem selected={key==satellite} onClick={()=>(setSatellite(key))}  button>
                  <div>
                    <Typography className={classes.full} variant="subtitle1" gutterBottom>
                      {sat.name}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      {sat.country_name}
                    </Typography>
                    <div style={{display:'flex'}}>
                      <Avatar alt={sat.country_name} src={sat.real_images[0]} />
                      <Avatar alt={sat.country_name} src={sat.country_flag} />
                    </div>
                    <center >
                      <Button style={{marginTop:'10px'}} onClick={()=>{setDesDialog(true)}} variant="outlined" color="primary" >
                        Details
                      </Button>
                    </center>
                    <Typography style={{marginTop:'10px'}} variant="body2" gutterBottom>
                      <VisibilityIcon color='primary'/>
                      <font className='statLabel' color="#00977bb">
                        {key+'_v' in stats?stats[key+'_v']:0}
                        </font>
                        <div style={{float:'right',cursor:'pointer'}} onClick={()=>{loadComments(key)}}>
                          <MessageIcon color='primary'/>
                          <font className='statLabel' color="#00977bb">
                            {key+'_c' in stats?stats[key+'_c']:0}
                          </font>
                        </div>
                    </Typography>
                  </div>
                </ListItem>
              <Divider />
              <Divider />
              </div>
            )
          })
        }
      </List>
      <Divider />
    </div>
  )

  return(
      <div className={classes.root}>
      <Snackbar
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={notification}
        onClose={()=>{setNotification(false)}}
        autoHideDuration={3000}
        message={message}
      />
      <Dialog open={video} onClose={()=>{setVideo(false)}} aria-labelledby="form-dialog-title">
          <DialogTitle id="form-dialog-title">How to use</DialogTitle>
          <DialogContent className={classes.root}>
            <iframe width="560" height="315" src="https://www.youtube.com/embed/jHfov2AC6ZA" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </DialogContent>
          <DialogActions>
            <Button onClick={()=>{setVideo(false)}} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={social} onClose={()=>{setSocial(false)}} aria-labelledby="form-dialog-title">
            <DialogTitle id="form-dialog-title">Social Features</DialogTitle>
            <DialogContent className={classes.root}>
              <img src={require('../assets/social.jpg')} width='100%'/>
            </DialogContent>
            <DialogActions>
              <Button onClick={()=>{setSocial(false);setCookie();}} color="secondary">
                Don't show again
              </Button>
              <Button onClick={()=>{setSocial(false)}} color="primary">
                Close
              </Button>
            </DialogActions>
          </Dialog>
        <Dialog open={developer} onClose={()=>{setDeveloper(false)}} aria-labelledby="form-dialog-title">
            <DialogTitle id="form-dialog-title">Md. Mehrab Haque , Bangladesh</DialogTitle>
            <DialogContent>
              <Typography variant="body">
                Currently studying CSE in BUET (L-1/T-2 currently (2020))
              </Typography><br/>
              <Typography variant="body">
                Email : mehrab.haque.0001@gmail.com
              </Typography><br/>
              <Typography variant="body">
                <a href='https://github.com/mehrab-haque'>Github</a><span> </span><span> </span>
                <a href='https://www.facebook.com/mdmehrab.haque.9'>Facebook</a><span> </span><span> </span>
                <a href='https://www.linkedin.com/in/md-mehrab-haque-1607401a0/'>LinkedIn</a><span> </span><span> </span>
              </Typography>
              <center>
                <img width='50%' style={{borderRadius:'100%'}} src={require('../assets/me.png')}/>
              </center>
              <Typography variant="body">
                This web app is a part of the project "Satellight" which is submitted to NASA space app challenge, me and my other team-mates are participating as "BUET Zenith", they are also contributing to other parts of the project such as android, arduino and data collection.<br/>
                <ul>
                  <li>Rabib Jahin : Raw data collection (which is implemented in this site).</li>
                  <li>Tamim Ehsan : Arduino pointer device and presentation.</li>
                  <li>Hasan Masum : Android</li>
                  <li>Md. Jehadul Karim Sabit : Android</li>
                  <li>Fabiha Tasneem : Presentation</li>
                </ul>
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={()=>{setDeveloper(false)}} color="primary">
                Ok
              </Button>
            </DialogActions>
          </Dialog>
          <Dialog open={comments} onClose={()=>{setComments(false)}} aria-labelledby="form-dialog-title">
              <DialogTitle id="form-dialog-title">{sat_data[satellite].name}</DialogTitle>
              <DialogContent>
                <Button onClick={()=>{setAddComment(true)}} color="primary" variant='outlined' fullWidth>
                  + Add Your Comment
                </Button>
                {Object.keys(commentsData).reverse().map(commentKey=>{
                  var comment=commentsData[commentKey]
                  return(
                    <div style={{backgroundColor:'#eaeaea',marginTop:'5px',padding:'4px'}}>
                      <div style={{display:'flex'}}>
                        <Avatar className={classes.orange}>
                          {comment.name.substr(0,1)}
                        </Avatar>
                        <div style={{padding:'4px'}}>
                          <font><b>{comment.name}</b></font><br/>
                          <Typography variant="body2">
                            {new Date(comment.timestamp).toLocaleString()}
                          </Typography>
                        </div>
                      </div>
                      <Typography variant="body">
                        {comment.comment}
                      </Typography>
                    </div>
                  )
                })}
              </DialogContent>
              <DialogActions>
                <Button onClick={()=>{setComments(false)}} color="primary">
                  Ok
                </Button>
              </DialogActions>
            </Dialog>
            <Dialog open={addComment} onClose={()=>{setAddComment(false)}} aria-labelledby="form-dialog-title">
                <DialogTitle id="form-dialog-title">Add Comment</DialogTitle>
                <DialogContent>
                  <TextField
                    inputRef={nameRef}
                    label="Your Name"
                    variant="outlined"
                    fullWidth
                  />
                  <TextField
                    style={{marginTop:'5px'}}
                    inputRef={commentRef}
                    label="Your Comment"
                    multiline
                    variant="outlined"
                    fullWidth
                    rows={4}
                  /><br/>
                </DialogContent>
                <DialogActions>
                  <Button onClick={()=>{setAddComment(false)}} color="primary">
                    Cancel
                  </Button>
                  <Button onClick={postComment} color="primary">
                    Post Comment
                  </Button>
                </DialogActions>
              </Dialog>
      <Dialog open={timeDialog} onClose={()=>{setTimeDialog(false);}} aria-labelledby="form-dialog-title">
          <DialogTitle id="form-dialog-title">Set timeline</DialogTitle>
          <DialogContent className={classes.root}>

          <TextField
            inputRef={timeRef}
            id="datetime-local"
            label="timeline starting point"
            type="datetime-local"
            defaultValue="2020-10-01T22:30"
            InputLabelProps={{
              shrink: true,
            }}
          />

          </DialogContent>
          <DialogActions>
            <Button onClick={()=>{setTimeDialog(false)}} color="secondary">
              Cancel
            </Button>
            <Button onClick={gotoTimeLine} color="primary">
              Go
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={finder} onClose={()=>{setFinder(false);}} aria-labelledby="form-dialog-title">
            <DialogTitle id="form-dialog-title">Find {sat_data[satellite].sat_name} from your location based on the selected timeline (present/past/future)</DialogTitle>
            <DialogContent className={classes.root}>
              <div>
                <b>Direct Distance from you : {satData!=null?satData.range.toFixed(3):''} km</b><br/>
                <b>Horizontal Angle : {satData!=null?satData.azimuth.toFixed(3):''} Degrees</b><br/>
                <center><canvas ref={hRef} width={canvasDim} height={canvasDim}></canvas></center><br/><br/><br/>
                <b>Vertical Angle : {satData!=null?satData.elevation.toFixed(3):''} Degrees</b><br/>
                <center><canvas ref={vRef} width={canvasDim} height={canvasDim}></canvas></center>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={()=>{setFinder(false)}} color="primary">
                Ok
              </Button>
            </DialogActions>
          </Dialog>
        <Dialog open={desDialog} onClose={()=>{setDesDialog(false);}} aria-labelledby="form-dialog-title">
            <DialogTitle id="form-dialog-title">{sat_data[satellite].sat_name}</DialogTitle>
            <DialogContent>
              <Typography variant="body">
                {sat_data[satellite].name}
                {sat_data[satellite].isGeoStationary?'(Geostationary)':''}
              </Typography>
              <Typography variant="body"><br/>
                Country : {sat_data[satellite].country_name}
              </Typography>
              <Typography variant="body"><br/>
                Type : {sat_data[satellite].type}
              </Typography>
              <Typography variant="body"><br/>
                Launch Date : {sat_data[satellite].launch_date}
              </Typography>
              <Typography variant="body"><br/>
                Mission Duration : {sat_data[satellite].mission_duration}
              </Typography>
              <Typography variant="body"><br/>
                Launch Mass : {sat_data[satellite].launch_mass}
              </Typography>
              <br/>
              {
                sat_data[satellite].real_images.map(url=>{
                  return(
                    <img style={{marginLeft:'2px'}} src={url} width='30%'/>
                  )
                })
              }
              <Typography variant="body"><br/>
                {sat_data[satellite].description}
              </Typography>
              <br/><br/>
                <b><u>Use Cases :</u></b>
              <Typography variant="body"><br/>
                <ul>
                  {
                    sat_data[satellite].use_cases.map((usage,ind)=>{
                      return(
                        <li>{usage}</li>
                      )
                    })
                  }
                </ul>
              </Typography>

            </DialogContent>
            <DialogActions>
              <Button onClick={()=>{setDesDialog(false)}} color="secondary">
                Ok
              </Button>
            </DialogActions>
          </Dialog>
        <CssBaseline />
        <AppBar style={{backgroundColor:'#0090ff'}} position="fixed" className={classes.appBar}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              className={classes.menuButton}
            >
              <MenuIcon />
            </IconButton>
              <Typography variant="h6" noWrap>
                Satellight : putting light on satellites
              </Typography>
          </Toolbar>
        </AppBar>
        <nav className={classes.drawer} aria-label="mailbox folders">
          {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
          <Hidden smUp implementation="css">
            <Drawer
              container={container}
              variant="temporary"
              anchor={theme.direction === 'rtl' ? 'right' : 'left'}
              open={mobileOpen}
              onClose={handleDrawerToggle}
              classes={{
                paper: classes.drawerPaper,
              }}
              ModalProps={{
                keepMounted: true, // Better open performance on mobile.
              }}
            >
              {drawer}
            </Drawer>
          </Hidden>
          <Hidden xsDown implementation="css">
            <Drawer
              classes={{
                paper: classes.drawerPaper,
              }}
              variant="permanent"
              open
            >
              {drawer}
            </Drawer>
          </Hidden>
        </nav>
        <main className={classes.content}>
          <div style={{marginBottom:'-6px',padding:'0px'}} className={classes.toolbar} />
            <div className='container' ref={containerRef} style={{height:'100%'}}>
              {
                mode=='map'?(
                    <MapView location={location} fpv={fpv} key={[satellite,timeDiff]} ref={viewRef} satCode={satellite} data={sat_data[satellite]} timeDiff={timeDiff}/>
                ):(
                  mode=='night'?(
                      <NightSkyView location={location} fpv={fpv} key={[satellite,timeDiff]} ref={viewRef} satCode={satellite} data={sat_data[satellite]} timeDiff={timeDiff}/>
                  ):(
                    mode=='3d'?(
                        <ModelView location={location} show={modelSatClick} parent={containerRef} ref={viewRef} satCode={satellite} data={sat_data[satellite]} timeDiff={timeDiff}/>
                    ):(
                      mode=='fpv'?(
                          <FPVView location={location} ref={viewRef} satCode={satellite} data={sat_data[satellite]} timeDiff={timeDiff}/>
                      ):(
                        <br/>
                      )
                    )
                  )
                )
              }
          </div>
        </main>
      </div>


  )
}

export default Main
