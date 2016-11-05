var courses = require('../coursesList.js');

var uwaterlooApi = require('uwaterloo-api');

var uwclient = new uwaterlooApi({
      API_KEY : '495cd8d2ca5f93e44f1171f5b58e59a0'
});

var formatExam = function (message,callback) {
  lookUpExam(message,function(res) {
    // sometimes data is empty
      if(_.isEmpty(res["data"])) {
        callback("course invalid");
      } else {
        var answer = "it will be on " + res["data"]["sections"][0]["day"] + " " +
          res["data"]["sections"][0]["date"] + " From " + res["data"]["sections"][0]["start_time"]
          + " To " + res["data"]["sections"][0]["end_time"] + " at " + res["data"]["sections"][0]["location"];
          callback(answer);
      }
  });
}

var lookupExam = function (message, callback) {
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
    uwclient.get('/courses/'+courseRequested[0]+'/'+courseRequested[1]+'/examschedule',{},function(err,res) {
      if(err) {
        console.log("UW API ERROR " + err);
      } else {
        console.log(res);
        callback(res);
      }
    });
}

module.exports = {
  formatExam:formatExam,
  lookupExam:lookupExam
}