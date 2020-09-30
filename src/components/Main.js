import React,{useState,useEffect,useRef} from 'react'
import{makeStyles,useTheme,Button,TextField,Avatar,Tooltip,Drawer,IconButton,Hidden,CssBaseline,AppBar,Toolbar,List,Typography,Divider,ListItem} from '@material-ui/core'
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import MenuIcon from '@material-ui/icons/Menu';
import ExploreIcon from '@material-ui/icons/Explore';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import SportsBaseballIcon from '@material-ui/icons/SportsBaseball';
import VisibilityIcon from '@material-ui/icons/Visibility';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import AccessAlarmsIcon from '@material-ui/icons/AccessAlarms';
import {sat_data} from '../assets/master'
import MapView from './MapView'
import NightSkyView from './NightSkyView'
import ModelView from './ModelView'

const drawerWidth = 240;
const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
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

  tokenObject[code]=tokens
})

//console.log(tokenObject)

//console.log(tokenObject)

const Main=props=>{
  const { window } = props;
  const classes = useStyles();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState('map');
  const [time,setTime]=useState('live')
  const [satellite,setSatellite]=useState('27424'/*25544*/)
  const [searchFilter,setSearchFilter]=useState(sat_data)
  const [timeDiff,setTimeDiff]=useState(0)

  const viewRef=useRef()
  const containerRef=useRef()


  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMode = (event, newMode) => {
    setMode(newMode);
  };

  const handleTime = (event, newTime) => {
    setTime(newTime);
  };

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
    viewRef.current.setSatellite({
      satCode:satellite,
      data:sat_data[satellite]
    })
  },[satellite])

  const container = window !== undefined ? () => window().document.body : undefined;
  const drawer=(
    <div className='explorer'>
    <center>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleMode}
        aria-label="text alignment"
        style={{marginTop:'5px'}}
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
        <ToggleButton value="other" aria-label="left aligned">
          <Tooltip title="Past/Future">
            <AccessAlarmsIcon/>
          </Tooltip>
        </ToggleButton>
          </ToggleButtonGroup>



        <TextField style={{marginTop:'20px'}} onChange={filter} id="outlined-basic" label="Search" variant="outlined" />
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
                    <Typography variant="subtitle1" gutterBottom>
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
                      <Button style={{marginTop:'10px'}} variant="outlined" color="primary" >
                        Details
                      </Button>
                      <Button style={{marginTop:'10px',marginLeft:'5px'}} variant="outlined" color="primary" >
                        Plot
                      </Button>
                    </center>
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
                    <MapView key={Date.now()} ref={viewRef} satCode={satellite} data={sat_data[satellite]} timeDiff={timeDiff}/>
                ):(
                  mode=='night'?(
                      <NightSkyView key={Date.now()} ref={viewRef} satCode={satellite} data={sat_data[satellite]} timeDiff={timeDiff}/>
                  ):(
                    mode=='3d'?(
                        <ModelView parent={containerRef} ref={viewRef} satCode={satellite} data={sat_data[satellite]} timeDiff={timeDiff}/>
                    ):(
                      <br/>
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
