"use strict"

//import dependencies
const axios = require('axios')
const scheduler = require('node-schedule')
const { RTMClient, WebClient } = require('@slack/client');

//object for tokens
const tokenObj = {
  bot: 'xoxb-171585243110-390996567013-9eHeM4ESvyenHuxAjQCte0PU',
  weather: 'e38b87fbbf220b709a568eb6aaa6e248'
}

//start real-time-messenger
let rtm = new RTMClient(tokenObj.bot);
rtm.start();

//get channels so weather can be broadcast is it is different from day before
const web = new WebClient(tokenObj.bot);

//compare weather function
async function compareWeather(responseChannels){
  let yesterdaysWeather = await getWeather(modifyDate(-1))
  let todaysWeather = await getWeather()

  //if weather is different...
  if (yesterdaysWeather.currently.temperature > todaysWeather.currently.temperature + 10 ||
    yesterdaysWeather.currently.temperature < todaysWeather.currently.temperature - 10 ||
    yesterdaysWeather.currently.precipProbability > todaysWeather.currently.precipProbability + 0.3 ||
    yesterdaysWeather.currently.precipProbability < todaysWeather.currently.precipProbability - 0.3) {

    //...broadcast to all channels
    for (channel in responseChannels) {
      rtm.sendMessage(`${res.data.hourly.summary}`, channel.id)
    }
  }
}

//get all channels
web.channels.list()
  .then((res) => {

    //find all channels bot has access to
    const channels = res.channels.filter(c => c.is_member);

    if (channels.length > 0) {
      //schedule broadcast to all channels at 7am (if weather ends up being different)
      scheduler.scheduleJob('* * 6 * * *', function() {
        compareWeather(channels)
      })
    }
    else {
      console.log('This bot does not belong to any channel, invite it to at least one and try again');
    }
  });

//extra function - adds tips if certain weather conditions are met
function addHotTips(weatherObj){
  let tips = 'Hot tip(s): '
  if (weatherObj.currently.temperature > 80) {tips += 'you are going to sweat, '}
  if (weatherObj.currently.precipProbability > 0.3) {tips += 'you may need an umbrella, '}
  if (weatherObj.currently.uvIndex > 3) {tips += 'you ought to wear sunscreen, '}
  tips = tips.length < 14 ? '' : tips.slice(0, tips.length-2) + '.'
  return tips
}

//helper function for getting yesterday's/tomorrow's date
function modifyDate(num){
      let tmrw = new Date
      tmrw.setDate(tmrw.getDate() + num)
      return `,${tmrw.getFullYear()}-${('0' + tmrw.getMonth()).slice(-2)}-${('0' + tmrw.getDate()).slice(-2)}T08:00:00`
}

function getWeather (notToday, responseChannel, hourly) {

    //for api request
    let time = ''
    //for user response
    let tense = 'is currently'

    //unless we are getting today's weather, change the API call and grammar of response
    if(notToday){
      time = notToday
      tense = 'will be'
    }

    //api request
    axios.get("https://api.darksky.net/forecast/" +  tokenObj.weather + "/40.7128,-74.0059" + time)
      .then((res) => {
        //if user requested hourly temp, send hourly temps
        if (hourly) {
          let hourlyTempArr = res.data.hourly.data.map((obj)=>{return `${obj.temperature}`})
          rtm.sendMessage(`${hourlyTempArr.slice(0, 23).join(' \n')}`, responseChannel)
            .catch((err)=>{console.log('yep',err)})
        }
        //if user requested weather, send weather with hot tips
        else if(responseChannel) {
          rtm.sendMessage(`${res.data.hourly.summary} Temperature ${tense} ${res.data.currently.temperature}. ${addHotTips(res.data)}`, responseChannel)
            .catch((err)=>{console.log('yep',err)})
        }
        //otherwise this is being used by compareWeather function, which needs the response object
        else {
          return res.data
        }
      })
      .catch((error) => {
        console.log(error)
      })
}

//call getWeather function based on user requests
rtm.on('message', (message) => {
  switch (message.text) {
    case 'Weather now':
      getWeather(false, message.channel)
      break;
    case 'Weather tomorrow':
      getWeather(modifyDate(1), message.channel)
      break;
    case 'Hourly temp':
      getWeather(false, message.channel, true)
      break;
    default:
      break;
  }
})

