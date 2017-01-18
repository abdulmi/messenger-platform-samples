var courses = require('../coursesList.js');
var uwaterlooApi = require('uwaterloo-api');
var moment = require('moment-timezone');
var uwclient = new uwaterlooApi({
      API_KEY : '495cd8d2ca5f93e44f1171f5b58e59a0'
});
var _ = require('underscore');

var formatSection = function (message,callback) {
  lookUpSection(message,function(res) {
    // sometimes data is empty
      var days = ['sunday','M','T','W','Th','F','saturday'];
      var currentDay = moment().tz("America/New_York").day()-1
      var currentHour = moment().tz("America/New_York").hours()-15;
      var currentMinute = moment().tz("America/New_York").minutes()
      var today = days[currentDay]
      if(_.isEmpty(res["data"])) {
        callback("course invalid");
      } else {
        var answer = ""
        var len = res["data"].length;
        for(var i = 0; i<len; i++) {
          var course = res["data"][i];
          console.log("fuck")
          console.log(len);
          console.log(course)
          if(course["section"].indexOf("LEC") != -1) {
              dataObj = course["classes"][0]
              day = dataObj["date"]["weekdays"]
              startTimeHour = parseInt(dataObj["date"]["start_time"].split(":")[0])
              startTimeMinute = parseInt(dataObj["date"]["start_time"].split(":")[1])
              endTimeHour = parseInt(dataObj["date"]["end_time"].split(":")[0])
              endTimeMinute = parseInt(dataObj["date"]["end_time"].split(":")[1])
              if((day.indexOf(today) != -1) && (currentHour <= startTimeHour)) {
                  if((currentHour == startTimeHour && currentMinute <= startTimeMinute) ||
                      (currentHour < startTimeHour)) {
                  answer += startTimeHour.toString() +":"+startTimeMinute.toString()+ " to "+endTimeHour.toString()+":"+endTimeMinute.toString()+ " with " + dataObj["instructors"] + " at " + dataObj["location"]["building"]+dataObj["location"]["room"] + "\n"
                }
          }
        }
        if(answer === "") {
          answer += "No timings offered for the rest of the day\n"
        }
        callback(answer);
      }
    }
  });
}

var lookUpSection = function (message, callback) {
   var messageUpperText = message.toUpperCase();
   var arrayMessage = messageUpperText.split(" ");
    var courseRequested = _.intersection(arrayMessage,courses.allCourses);
    //check if course is not valid
    if(courseRequested.length === 0) {
      callback("course invalid");
      return;
    } else {
      courseRequested = courseRequested[0].match(/[a-zA-Z]+|[0-9]+/g);
    }
    console.log(courseRequested);
    uwclient.get('/courses/'+courseRequested[0]+'/'+courseRequested[1]+'/schedule',{},function(err,res) {
      if(err) {
        console.log("UW API ERROR " + err);
      } else {
        console.log(res);
        callback(res);
      }
    });
}

module.exports = {
  formatSection:formatSection,
  lookUpSection:lookUpSection
}
