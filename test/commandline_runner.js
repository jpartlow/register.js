// From http://twoguysarguing.wordpress.com/2010/11/02/make-javascript-tests-part-of-your-build-qunit-rhino/
load("test/qunit-cli.js")
 
QUnit.init()
QUnit.config.blocking = false
QUnit.config.autorun = true
QUnit.config.updateRate = 0
QUnit.log = function(result, message) {
  var output = message
  var md = /class="test-message">([^<]*)</.exec(message) // strip <span>
  if (md) {
    output = md[1]
  }
  print(result ? 'PASS' : 'FAIL', output)
}

load("test/lib/env.rhino.js")
window.location = "test/base.html"

load("lib/prototype.js")
Prototype.BrowserFeatures.XPath = false; 
load("lib/credit_card_track_parser.js")
load("src/register-core.js")
load("test/test_helper.js")
tests = arguments
tests.each(function(t) { load(t) })
