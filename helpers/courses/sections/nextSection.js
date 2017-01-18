var courses = require('../coursesList.js');
var uwaterlooApi = require('uwaterloo-api');
var uwclient = new uwaterlooApi({
      API_KEY : '495cd8d2ca5f93e44f1171f5b58e59a0'
});
var _ = require('underscore');

var formatSection = function (message,callback) {
  lookUpSection(message,function(res) {
    // sometimes data is empty
      if(_.isEmpty(res["data"])) {
        callback("course invalid");
      } else {
        var answer = ""
        /*for (var course in res) {

        }*/
        // callback(answer);
        var d = new Date()
        d.setTime(d.getTime() - d.getTimezoneOffset() * 60 * 1000)
        callback(d)
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
