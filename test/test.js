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
