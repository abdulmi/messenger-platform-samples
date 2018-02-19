var foodPlaces = require('./foodPlaceObjects.js');
var uwaterlooApi = require('uwaterloo-api');

var uwclient = new uwaterlooApi({
  API_KEY : process.env.UW_API_KEY
});

var LookupRestaurant = function (restaurant,location,callback) {
  var objectsMatch = [];
  uwclient.get('/foodservices/locations',function(err,res) {
    if(err) {
      console.log("UW API ERROR " + err);
    } else {
      if(location != undefined) {
        for (var i = 0;i < res["data"].length;i+=1) {
          if((res["data"][i]["outlet_name"].indexOf(restaurant) !== -1) && res["data"][i]["building"] === location) {
            objectsMatch.push(res["data"][i]);
          } else {
            continue;
          }
        }
      } else {
        for (var i = 0;i < res["data"].length;i+=1) {
          if(res["data"][i]["outlet_name"].indexOf(restaurant) !== -1) {
            objectsMatch.push(res["data"][i]);
          } else {
            continue;
          }
        }
      }
    }
    callback(objectsMatch);
  });
};

var formatRestaurant = function (restaurant,location,hours,callback) { 
  var answer = "";
  if(hours) {
    var now = new Date();
    var days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    var today = days[now.getDay()];
    LookupRestaurant(restaurant,location,function(res) {
      for(var i = 0;i < res.length; ++i) {
        if(res[i]["is_open_now"] == true) {
          answer += res[i]["outlet_name"] + " [OPEN]\n";
          answer += res[i]["opening_hours"][today]["opening_hour"] + " to " + res[i]["opening_hours"][today]["closing_hour"] + "\n";
        } else {
          answer += res[i]["outlet_name"] + " [CLOSE]\n";
          if(!res[i]["opening_hours"][today]["is_closed"]) {
            answer += res[i]["opening_hours"][today]["opening_hour"] + " to " + res[i]["opening_hours"][today]["closing_hour"] + "\n";
          } else {
            answer += "Closed today\n";
          }
        }
      }
      callback(answer);
    });
  } else {
    LookupRestaurant(restaurant,location,function(res) {
      for(var i = 0;i < res.length;++i) {
        if(res[i]["is_open_now"] == true) {
          answer += res[i]["outlet_name"] + " [OPEN]\n";
        } else {
          answer += res[i]["outlet_name"] + " [CLOSE]\n";
        }
      }
      console.log("answer is " + answer);
      callback(answer);
    });
  }
};

var findEatingPlace = function (message) {
  console.log("message in findEatingPlace " + message);
  console.log("foodplaces array " + foodPlaces.foodPlacesarr);
  var len = foodPlaces.foodPlacesarr.length;
  for(var i = 0; i < len; i++) {
    var placeName = foodPlaces.foodPlacesarr[i]["name"].toUpperCase();
    if(message.toUpperCase().indexOf(placeName) !== -1) {
      console.log("found place " + JSON.stringify(foodPlaces.foodPlacesarr[i]));
      return foodPlaces.foodPlacesarr[i];
    }
  }
  return null;
};


var findFoodBuilding = function (message, food) {
  var arr = food["places"];
  console.log("food param is " + food);
  console.log("name is "+food["name"]);
  console.log("places are "+food["places"]);
  var len = arr.length;
  for(var i = 0; i < len; i++) {
    if(message.toUpperCase().indexOf(arr[i].toUpperCase()) !== - 1) {
      return arr[i];
      console.log(arr[i]);
    }
  }
  return null;
};



module.exports = {
  LookupRestaurant: LookupRestaurant,
  formatRestaurant: formatRestaurant,
  findEatingPlace: findEatingPlace,
  findFoodBuilding: findFoodBuilding
}