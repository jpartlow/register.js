function pretty_print(object) {
  var debug = "{ "
  for (var property in object) {
    if (typeof object[property] != 'function') {
      debug += property + " : " + object[property] + ", " 
    }
  }
  print(debug + "}")
}

function GoldData() {}
GoldData.prototype = {
  dummy_visa_tracks : "%B4111111111111111^LAST/FIRST^15031019999900888000000?;4111111111111111=150310199999888?",
  visa : {
    track1 : "B4111111111111111^LAST/FIRST^15031019999900888000000",
    track2 : "4111111111111111=150310199999888",
    number : "4111111111111111",
    expiration : "1503",
    month: "03",
    year: "2015",
    first_name : "FIRST",
    last_name : "LAST",
    service_code : "101",
    format_code : "B"
  },
  dummy_mastercard_tracks : "%B5555555555554444^LAST/FIRST^14021019999900888000000?;5555555555554444=14021019999988800000?",
  mc : {
    track1 : "B5555555555554444^LAST/FIRST^14021019999900888000000",
    track2 : "5555555555554444=14021019999988800000",
    number : "5555555555554444",
    expiration : "1402",
    month: "02",
    year: "2014",
    first_name : "FIRST",
    last_name : "LAST",
    service_code : "101",
    format_code : "B"
  },
}
var test_state;
var register;

module("register", {
  setup: function() {
    test_state = new GoldData()
    register = new Register()
  },
})
test("something", function() {
  ok(false, 'should be false')
  equals('1','0', 'unequal strings')
  equals(1, 1, 'equal numbers')
  equals(1, 0, 'track_data property')
})
