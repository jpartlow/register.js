Register.js
===========

This is a simple cash register library implemented in Javscript.

*THIS PROJECT IS CURRENTLY A STUB*

Dependencies
------------

 * [Prototype](http://prototypejs.org) v1.6.0.3
 * [credit_card_track_parser](https://github.com/jpartlow/credit_card_track_parser) v0.1.0

Both can be found in /lib.

Running Tests
-------------

[QUnit](http://docs.jquery.com/QUnit) is being used to test the library.

The preferred method for running the tests is using the Javascript interpreter of your browser by viewing test/tests.html in your browser.

You may also run the tests on the commandline with Rhino by executing test/commandline_runner.js with your interpretter from the root of the project:

    rhino -opt -1 test/commandline_runner.js <test>
