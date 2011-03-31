module("register-construction")

test("construct", function() {
  expect(3)
  var register = new Register.Instance()
  ok(register)
  register = new Register.Instance({})
  ok(register)
  register = new Register.Instance({
    purchase_codes: [ ],
    payment_codes: [ ],
    credit_codes: [ ],
    ledger: [ ],
    payment: {},
    templae: {}, 
  })
  deepEqual(register.purchase_codes, [ ])
})

test("initialize_array_of", function() {
  expect(1)
  var core = new Register.Core()
  deepEqual(core.initialize_array_of(Register.Code, [ {}, {} ]), [ new Register.Code(), new Register.Code() ])
})

test("inherits", function() {
  expect(3)
  var A = function() {}
  A.prototype.foo = 'foo'
  var B = function() {}
  B.inherits(A)
  strictEqual(B.prototype.constructor, B)
  strictEqual(B.prototype.parent, A.prototype)
  var b = new B()
  equal(b.foo, 'foo')
})

test("gold-data", function() {
  expect(4)
  gd = new GoldData()
  var pc = gd.purchase_codes
  equal(pc.length, 2)
  pc.push(3)
  equal(gd.purchase_codes.length, 3)
  gd = new GoldData()
  equal(gd.purchase_codes.length, 2)
  equal(pc.length, 3)
})

module("register-util")
test("locate", function() {
  expect(6)
  var rc = new Register.Core()
  equal(rc.locate('register'), $('register'), 'handles id string')
  var div = new Element('div').update('<div id="foo">Foo</div>')
  equal(div.down('#foo'), rc.locate('foo', div), 'finds by id string within a context')
  raises(function() { rc.locate('does-not-exist', div) }, Register.Exceptions.MissingElementException, 'should raise MissingElementException if id does not exist in element descendents')
  raises(function() { rc.locate('does-not-exist') }, Register.Exceptions.MissingElementException, 'should raise MissingElementException if id does not exist in document')
  is_undefined(rc.locate('does-not-exist', div, false), 'should not raise if does not exist in element descendants and loudly is set false')
  is_undefined(rc.locate('does-not-exist', null, false), 'should not raise if id does not exist in document and loudly is set false')
})

test("is_null_or_undefined", function() {
  expect(6)
  var o = new Object()
  ok(Object.is_null_or_undefined(null), 'matches null')
  ok(Object.is_null_or_undefined(undefined), 'matches undefined')
  ok(!Object.is_null_or_undefined(o), 'does not catch other objects')
  ok(!Object.is_null_or_undefined(false), 'does not catch false')
  ok(!Object.is_null_or_undefined(0), 'does not catch zero')
  ok(!Object.is_null_or_undefined(''), 'does not catch empty string')
})

module("register-new-payment", {
  setup: function() {
    this.gold = new GoldData()
    this.register = new Register.Instance(this.gold.new_payment_register_config())
  },
})
test("initialize", function() {
  expect(1)
  is_instance_of(this.register, Register.Instance)
})

test("register-ui-initialization", function() {
  expect(9)
  var ui = this.register.ui
  is_instance_of(ui, Register.UI)
  strictEqual(ui.template_source, this.gold.template)
  is_instance_of(ui.register_template, Element, 'ui should initialize a template register element')
  equal(ui.register_template.id, 'register', 'ui element id should be register')
  is_instance_of(ui.ledger_row_template, Element, 'ui should have a ledger row template element')
  equal(ui.ledger_row_template.id, Register.UI.LEDGER_ROW_TEMPLATE_ID)
  equal(ui.locate(Register.UI.LEDGER_ROW_TEMPLATE_ID, ui.register_template, false), undefined, 'ledger row template should have been removed from main template')
  is_instance_of(ui.root, Element, 'ui should clone a root register element')
  ui.root.update('foo')
  ok(ui.register_template.innerHTML != 'foo')
})

test("register-ui-purchase-code-select", function() {

})
