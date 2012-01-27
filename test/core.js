Register.debug = true

module("array")

test("sum", function() {
  is_undefined([].sum())
  is_undefined([].sum('amount'))
  equal([1, 2, 3].sum(), 6)
  equal(['1', '2.5', '3'].sum(), 6.5)
  equal(['foo', 2, 3].sum(), 5)
  equal([{ value: 2 }, { value: 5 }, { value: 3}].sum(), 10)
  equal([{ amount: '1' }, { amount: '2' }, {}].sum('amount'), 3)
  equal([{ get_amount: function() { return 1 } }, { get_amount: function() { return 4 } }].sum('get_amount'), 5)
  equal($A([{ get_amount: function() { return '2.5' } }, { get_amount: function() { return 4 } }]).sum('get_amount'), 6.5)
})

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
  deepEqual(
    core.initialize_array_of(Register.Code, [ {}, {} ]),
    [ 
      new Register.Code(),
      new Register.Code()
    ]
  )
})

test("initialize_array_of-lookup", function() {
  expect(3)
  var core = new Register.Core()
  var A = function (object) { for (var p in object) { this[p] = object[p] } }
  var config1 = { id: 10, prop: 'foo' }
  var config2 = { id: 20, prop: 'bar'} 
  var array = core.initialize_array_of(A, [ config1, config2 ]) 
  deepEqual(array, [ new A(config1), new A(config2) ])
  strictEqual(array.lookup(10), array[0]) 
  strictEqual(array.lookup(20), array[1]) 
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

test("monetize", function() {
  expect(13)
  var core = new Register.Core()
  equal(core.monetize(45)         , '45.00')
  equal(core.monetize('45')       , '45.00')
  equal(core.monetize(34.0, true) , '$34.00')
  equal(core.monetize(0.12)       , '0.12')
  equal(core.monetize('.12', true), '$0.12')
  equal(core.monetize('foo')      , 'foo')
  equal(core.monetize('foo', true), 'foo')
  equal(core.monetize('')         , '')
  equal(core.monetize('', true)   , '')
  equal(core.monetize(' ')        , ' ')
  equal(core.monetize(' ', true)  , ' ')
  equal(core.monetize(null)       , null)
  equal(core.monetize(undefined)  , undefined)
})

test("parseMoney", function() {
  expect(4)
  var core = new Register.Core()
  equal(core.parseMoney(45.1)          , 45.1)
  equal(core.parseMoney('45.10')       , 45.1)
  equal(core.parseMoney('$45.10')      , 45.1)
  equal(core.parseMoney('$45.105')      , 45.105)
})

test("convert_to_cents", function() {
  expect(10)
  var core = new Register.Core()
  equal(core.convert_to_cents(45.1)          , 4510)
  equal(core.convert_to_cents('45.01')       , 4501)
  equal(core.convert_to_cents('$45.10')      , 4510)
  equal(core.convert_to_cents('$45.105')     , 4511)
  equal(core.convert_to_cents('$18.99')      , 1899)
  equal(core.convert_to_cents(4510)          , 451000)
  equal(core.convert_to_cents('1899')        , 189900)
  ok(isNaN(core.convert_to_cents(null)))
  ok(isNaN(core.convert_to_cents(undefined)))
  ok(isNaN(core.convert_to_cents('foo')))
})

test("gold-data", function() {
  expect(4)
  gd = new GoldData()
  var pc = gd.purchase_codes
  equal(pc.length, 3)
  pc.push(3)
  equal(gd.purchase_codes.length, 4)
  gd = new GoldData()
  equal(gd.purchase_codes.length, 3)
  equal(pc.length, 4)
})

module("register-util")
test("locate", function() {
  expect(16)
  var rc = new Register.Core()
  equal(rc.locate('register'), $('register'), 'handles id string')
  equal(rc.locate('.remove-row-control'), $$('.remove-row-control').first(), 'handles selector')

  var div = new Element('div').update('<div id="foo">Foo</div><div class="bar">Bar</div>')
  var foo = div.down('#foo')
  var bar = div.down('.bar')
  equal(foo, rc.locate('foo', div), 'finds by id string within a context')
  equal(bar, rc.locate('.bar', div), 'finds by selector string within a context')
  raises(function() { rc.locate('does-not-exist', div) }, Register.Exceptions.MissingElementException, 'should raise MissingElementException if id does not exist in element descendents')
  raises(function() { rc.locate('.does-not-exist', div) }, Register.Exceptions.MissingElementException, 'should raise MissingElementException if selector does not match anything in element descendents')
  raises(function() { rc.locate('does-not-exist') }, Register.Exceptions.MissingElementException, 'should raise MissingElementException if id does not exist in document')
  is_undefined(rc.locate('does-not-exist', div, false), 'should not raise if does not exist in element descendants and loudly is set false')
  is_undefined(rc.locate('.does-not-exist', div, false), 'should not raise if selector does not match in element descendants and loudly is set false')
  is_undefined(rc.locate('does-not-exist', null, false), 'should not raise if id does not exist in document and loudly is set false')

  rc.root = div
  equal(foo, rc.locate('foo'), 'finds by id string within a context')
  equal(bar, rc.locate('.bar'), 'finds by selector string within a context')
  raises(function() { rc.locate('does-not-exist') }, Register.Exceptions.MissingElementException, 'should raise MissingElementException if id does not exist in context')
  raises(function() { rc.locate('.does-not-exist') }, Register.Exceptions.MissingElementException, 'should raise MissingElementException if selector does not match in context')
  is_undefined(rc.locate('does-not-exist', null, false), 'should not raise if id does not exist in context and loudly is set false')
  is_undefined(rc.locate('.does-not-exist', null, false), 'should not raise if selector does not match in context and loudly is set false')
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

test("equal_elements", function() {
  expect(16)
  var expected = new Element('option', { value: 1 }).update('Foo')
  var same = new Element('option', { value: 1 }).update('Foo')
  equal_element(expected, same)
  equal_element(expected, same, true)
  equal_elements([expected], [same])
  equal_elements([expected], [same], true)
})

test("send", function() {
  expect(6)
  var o = {
    a: 'property',
    2: 'property two',
    foo: function() { return 'fired foo' },
  }
  equal(Object.__send(o, 'a'), 'property')
  equal(Object.__send(o, 2), 'property two')
  equal(Object.__send(o, 'foo'), 'fired foo')
  var a = 'a'
  var two = 2
  var foo = 'foo'
  equal(Object.__send(o, a), 'property')
  equal(Object.__send(o, two), 'property two')
  equal(Object.__send(o, foo), 'fired foo')
})

module("register-code", {
  setup: function() {
    this.gold = new GoldData()
  }
})
test("init-code", function() {
  var code_data = this.gold.purchase_codes[2]
  var code = new Register.Code(code_data)
  strictEqual(code.id, code_data.id)
  strictEqual(code.label, code_data.label)
  strictEqual(code.code, code_data.code)
  strictEqual(code.account_number, code_data.account_number)
  strictEqual(code.account_name, code_data.account_name)
  strictEqual(code.fee_types, code_data.fee_types)
  strictEqual(code.account_type, code_data.account_type)
  strictEqual(code.debit_or_credit, code_data.debit_or_credit)
  strictEqual(code.payment_type, code_data.payment_type)
  strictEqual(code.allow_cash, code_data.allow_cash)
  strictEqual(code.require_detail, code_data.require_detail)
})

test("register-code-subtypes", function() {
  expect(8)
  var pc = new Register.PurchaseCode(this.gold.purchase_codes[0])
  var py = new Register.PaymentCode(this.gold.payment_codes[0])
  var cr = new Register.CreditCode(this.gold.credit_codes[0])
  var aj = new Register.AdjustmentCode(this.gold.adjustment_codes[0])
  
  ok( pc instanceof Register.PurchaseCode)
  ok( pc instanceof Register.Code)
  ok( py instanceof Register.PaymentCode)
  ok( py instanceof Register.Code)
  ok( cr instanceof Register.CreditCode)
  ok( cr instanceof Register.Code)
  ok( aj instanceof Register.AdjustmentCode)
  ok( aj instanceof Register.Code)
})

test("register-code-to-string", function() {
  expect(4)
  var pc = new Register.PurchaseCode(this.gold.purchase_codes[0])
  var py = new Register.PaymentCode(this.gold.payment_codes[0])
  var cr = new Register.CreditCode(this.gold.credit_codes[0])
  var aj = new Register.AdjustmentCode(this.gold.adjustment_codes[0])
  equal(pc.toString(), "[ST:Store Purchase]")
  equal("code: " + py, "code: [CA:Cash]")
  equal(cr.toString(), "[CVTC:Issue Credit Voucher]")
  equal(aj.toString(), "[CMP:Comp]")
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

test("register-initialization", function() {
  expect(2)
  var ledger = this.register.ledger
  deepEqual(ledger.config, { rows: undefined })
  deepEqual(ledger.rows, [])
})

test("register-find-code", function() {
  expect(4)
  var pc = this.gold.purchase_codes[0]
  var py = this.gold.payment_codes[0]
  var cr = this.gold.credit_codes[0]
  var aj = this.gold.adjustment_codes[0]
  deepEqual(this.register.find_code(pc.id), new Register.PurchaseCode(pc))
  deepEqual(this.register.find_code(py.id), new Register.PaymentCode(py))
  deepEqual(this.register.find_code(cr.id), new Register.CreditCode(cr))
  deepEqual(this.register.find_code(aj.id), new Register.AdjustmentCode(aj))
})

test("register-change-code", function() {
  expect(1)
  var change_code = this.gold.payment_codes[0]
  deepEqual(this.register.change_code(), new Register.PaymentCode(change_code))
})

test("register-switch-payment-code-to", function() {
  expect(3)
  this.register.ui.initialize()
  var py_code = this.gold.payment_codes[1]
  var pay_select = this.register.ui.payment_codes_select
  ok(pay_select.value != py_code.id)
  var changed = false
  pay_select.observe('change', function() {
    changed = true
  })
  this.register.switch_payment_code_to(py_code.payment_type)
  equal(pay_select.getValue(), py_code.id.toString())
  ok(changed, 'Fired payment code select onchange event.')
})

test("register-ledger-count", function() {
  expect(1)
  var ledger = this.register.ledger
  equal(ledger.count(), 0)
})

test("register-ledger-row-initialize", function() {
  expect(13)
  var pc = this.gold.purchase_codes[0]
  var lr = new Register.LedgerRow({
    code_type: 'purchase',
    code: pc,
    credit: '100',
  })
  is_instance_of(lr, Register.LedgerRow)
  // accessors
  strictEqual(lr.get_credit(), 100)
  ok(lr.is_credit())
  is_undefined(lr.get_debit())
  ok(!lr.is_debit())
  strictEqual(lr.get_amount(), 100)
  equal(lr.get_label(), pc.label)
  is_undefined(lr.get_detail())
  // other properties
  equal(lr.type, pc.account_type)
  equal(lr.account_number, pc.account_number)
  equal(lr.account_name, pc.account_name)
  equal(lr.register_code, pc.code)
  equal(lr.code_type, 'purchase')
})

test("register-ledger-row-initialize-require-detail", function() {
  expect(2)
  var pc = this.gold.purchase_codes[2]
  ok(pc.require_detail)
  var lr = new Register.LedgerRow({
    code_type: 'purchase',
    code: pc,
    credit: '100',
  })
  ok(lr.require_detail)
})

test("register-ledger-row-bad-initialization", function() {
  expect(5)
  var pc = this.gold.purchase_codes[0]
  var config = $H({
    code_type: 'purchase',
    code: pc,
    credit: '100',
  })
  raises(
    function() {
      new Register.LedgerRow(config.merge({code_type: 'foo'}).toObject())
    },
    Register.Exceptions.LedgerRowException,
    'bad code type'
  )
  raises(
    function() {
      new Register.LedgerRow(config.merge({debit: 100}).toObject())
    },
    Register.Exceptions.LedgerRowException,
    'both debit and credit set'
  )
  raises(
    function() {
      new Register.LedgerRow(config.merge({credit: '0'}).toObject())
    },
    Register.Exceptions.LedgerRowException,
    'zero amount'
  )
  raises(
    function() {
      new Register.LedgerRow(config.merge({credit: undefined}).toObject())
    },
    Register.Exceptions.LedgerRowException,
    'undefined amount'
  )
  raises(
    function() {
      new Register.LedgerRow(config.merge({credit: 50.5}).toObject())
    },
    function(exception) {
      var ok = (exception instanceof Register.Exceptions.LedgerRowException)
      ok = ok && (exception.message.match(/Expected.*integer cents/) != null)
      return ok
    },
    'float amount'
  )
})

test("register-ledger-row-initialize-from-dollars", function() {
  expect(40)
  var pc = this.gold.purchase_codes[0]
  var config = $H({
    code_type: 'purchase',
    code: pc,
  })
  var lr = new Register.LedgerRow(config.merge({credit_in_dollars: '1.00'}).toObject())
  assert_credit(lr, 100)
  strictEqual(lr.get_amount(), 100)
  var lr = new Register.LedgerRow(config.merge({credit_in_dollars: 2.99}).toObject())
  assert_credit(lr, 299)
  strictEqual(lr.get_amount(), 299)
  var lr = new Register.LedgerRow(config.merge({debit_in_dollars: '3.99'}).toObject())
  assert_debit(lr, 399)
  strictEqual(lr.get_amount(), -399)
  var lr = new Register.LedgerRow(config.merge({debit_in_dollars: 1.01}).toObject())
  assert_debit(lr, 101)
  strictEqual(lr.get_amount(), -101)
})

test("register-ledger-row-initialize-from-cents", function() {
  expect(40)
  var pc = this.gold.purchase_codes[0]
  var config = $H({
    code_type: 'purchase',
    code: pc,
  })
  var lr = new Register.LedgerRow(config.merge({credit_in_cents: '100'}).toObject())
  assert_credit(lr, 100)
  strictEqual(lr.get_amount(), 100)
  var lr = new Register.LedgerRow(config.merge({credit_in_cents: 299}).toObject())
  assert_credit(lr, 299)
  strictEqual(lr.get_amount(), 299)
  var lr = new Register.LedgerRow(config.merge({debit_in_cents: '399'}).toObject())
  assert_debit(lr, 399)
  strictEqual(lr.get_amount(), -399)
  var lr = new Register.LedgerRow(config.merge({debit_in_cents: 101}).toObject())
  assert_debit(lr, 101)
  strictEqual(lr.get_amount(), -101)
})

test("register-ledger-row-initialize-from-existing", function() {
  expect(17)
  var ldata1 = this.gold.ledger[1]
  var lr = new Register.LedgerRow(ldata1)
  is_instance_of(lr, Register.LedgerRow)
  // accessors
  assert_debit(lr, ldata1.debit_in_cents)
  equal(lr.get_label(), ldata1.code_label)
  is_undefined(lr.get_detail())
  // other properties
  equal(lr.type, ldata1.type)
  equal(lr.account_number, ldata1.account_number)
  equal(lr.account_name, ldata1.account_name)
  equal(lr.register_code, ldata1.register_code)
  equal(lr.code_type, ldata1.code_type)
})

test("register-ledger-row-set-amount", function() {
  expect(80)
  var pc = this.gold.purchase_codes[0]
  var config = {
    code_type: 'purchase',
    code: pc,
    credit: '100',
  }
  var lr = new Register.LedgerRow(config)
  assert_credit(lr, 100)
  strictEqual(lr.get_amount(), 100)

  lr.set_credit('150')
  assert_credit(lr, 150)
  strictEqual(lr.get_amount(), 150)

  lr.set_credit_in_cents(200)
  assert_credit(lr, 200)
  strictEqual(lr.get_amount_in_cents(), 200)

  lr.set_credit_in_dollars(3.99)
  assert_credit(lr, 399)
  strictEqual(lr.get_amount_in_dollars(), 3.99)

  lr.set_debit('600')
  assert_debit(lr, 600)
  strictEqual(lr.get_amount(), -600)

  lr.set_debit_in_cents('655')
  assert_debit(lr, 655)
  strictEqual(lr.get_amount_in_cents(), -655)

  lr.set_debit_in_dollars(7.01)
  assert_debit(lr, 701)
  strictEqual(lr.get_amount_in_dollars(), -7.01)
  
  lr.set_debit('-422')
  assert_credit(lr, 422)
  strictEqual(lr.get_amount(), 422)
})

test("register-ledger-row-set-fractional-amounts", function() {
  expect(10)
  var pc = this.gold.purchase_codes[0]
  var config = {
    code_type: 'purchase',
    code: pc,
    credit: '1050',
  }
  var lr = new Register.LedgerRow(config)
  assert_credit(lr, 1050)

  raises(
    function() {
      lr.set_credit('10.345')
    },
    function(exception) {
      var ok = (exception instanceof Register.Exceptions.LedgerRowException)
      ok = ok && (exception.message.match(/Expected.*integer cents/) != null)
      return ok
    },
    'float amount'
  )
})

test("register-ledger-add", function() {
  expect(1)
  var ledger = this.register.ledger
  var original_count = ledger.count() 
  ledger.add('purchase', '1','40')
  equal(ledger.count(), original_count + 1)
})

test("register-ledger-remove", function() {
  expect(2)
  var ledger = this.register.ledger
  var original_count = ledger.count() 
  var lr = ledger.add('purchase', '1','40')
  equal(ledger.count(), original_count + 1)
  ledger.remove(lr)
  equal(ledger.count(), original_count)
})

test("register-ledger-add-payment-change-with-cents", function() {
  expect(1)
  var ledger = this.register.ledger
  var py = this.gold.payment_codes[0]
  ledger.set_payment_code(py.id)
  var lr_integer = ledger.add('purchase', '1', '1000')
  var lr_float = ledger.add('purchase', '1', '699')
  equal(ledger.get_payment_total(), 1699)
})

test("register-ledger-row-destroy", function() {
  expect(2)
  var ledger = this.register.ledger
  var original_count = ledger.count() 
  var lr = ledger.add('purchase', '1','40')
  equal(ledger.count(), original_count + 1)
  lr.destroy() 
  equal(ledger.count(), original_count)
})

test("register-ledger-rows-by-type", function() {
  expect(4)
  var register = new Register.Instance(this.gold.edit_payment_register_config())
  var ledger = register.ledger
  equal(ledger.rows.length, 3)
  equal(ledger.purchase_rows().length, 1)
  equal(ledger.payment_rows().length, 1)
  equal(ledger.change_rows().length, 1)
})

test("register-ledger-totals-for-new", function() {
  expect(7)
  var ledger = this.register.ledger
  equal(ledger.get_purchase_total(), 0)
  equal(ledger.get_payment_total(), 0)
  equal(ledger.get_tendered_total(), 0)
  equal(ledger.get_credited_total(), 0)
  equal(ledger.get_change_total(), 0)
  equal(ledger.get_credits_total(), 0)
  equal(ledger.get_debits_total(), 0)
})

test("register-ledger-totals-for-existing", function() {
  expect(7)
  var register = new Register.Instance(this.gold.edit_payment_register_config())
  var ledger = register.ledger
  equal(ledger.get_purchase_total(), 3200)
  equal(ledger.get_payment_total(), 4000)
  equal(ledger.get_tendered_total(), 4000)
  equal(ledger.get_credited_total(), 0)
  equal(ledger.get_change_total(), 800)
  equal(ledger.get_credits_total(), 4000)
  equal(ledger.get_debits_total(), 4000)
})

test("register-ledger-set-payment-code", function() {
  expect(17)
  var ledger = this.register.ledger
  var pc = this.gold.purchase_codes[0]
  var py = this.gold.payment_codes[0]
  var py2 = this.gold.payment_codes[1]

  is_undefined(ledger.payment_row())
  is_undefined(ledger.payment_code)

  ledger.set_payment_code(py.id)
  equal(ledger.payment_code.id, py.id)
  is_undefined(ledger.payment_row())

  ledger.add_purchase(pc.id, 100)

  ok(ledger.payment_row())
  equal(ledger.payment_row().code.id, py.id)
  equal(ledger.payment_rows().length, 1)
  equal(ledger.change_rows().length, 0)
  equal(ledger.get_purchase_total(), 100)
  equal(ledger.get_payment_total(), 100)
  equal(ledger.get_change_total(), 0)

  ledger.set_payment_code(py2.id)
  equal(ledger.payment_row().code.id, py2.id)
  equal(ledger.payment_rows().length, 1)
  equal(ledger.change_rows().length, 0)
  equal(ledger.get_purchase_total(), 100)
  equal(ledger.get_payment_total(), 100)
  equal(ledger.get_change_total(), 0)
})

test("register-ledger-set-amount-tendered", function() {
  expect(7)
  var ledger = this.register.ledger
  strictEqual(ledger.get_amount_tendered_or_credited(), 0)
  ledger.set_amount_tendered('100')
  strictEqual(ledger.get_amount_tendered_or_credited(), 100)
  ledger.set_amount_tendered(544)
  strictEqual(ledger.get_amount_tendered_or_credited(), 544)
  raises(function() {
    ledger.set_amount_tendered(55.33)
  },Register.Exceptions.LedgerException, 'Cannot set amount tendered with a float')
  ledger.set_amount_tendered('0')
  strictEqual(ledger.get_amount_tendered_or_credited(), 0)
  ledger.set_amount_tendered('')
  strictEqual(ledger.get_amount_tendered_or_credited(), 0)
  ledger.set_amount_tendered()
  strictEqual(ledger.get_amount_tendered_or_credited(), 0)
})
 
test("register-ledger-payment-updates-change", function() {
  expect(6)
  var ledger = this.register.ledger
  var pc = this.gold.purchase_codes[0]
  var py = this.gold.payment_codes[0]
  is_undefined(ledger.payment_row())
  ledger.add_purchase(pc.id, 100)
  ledger.set_payment_code(py.id)
  is_undefined(ledger.change_row())

  ledger.set_amount_tendered(150)
  equal(ledger.change_rows().length, 1)
  equal(ledger.get_purchase_total(), 100)
  equal(ledger.get_payment_total(), 150)
  equal(ledger.get_change_total(), 50)
})

test("register-ui-initialization", function() {
  expect(8)
  var ui = this.register.ui.initialize()
  is_instance_of(ui, Register.UI)
  strictEqual(ui.template_source, this.gold.template)
  is_instance_of(ui.register_template, Element, 'ui should initialize a template register element')
  equal(ui.register_template.id, 'register', 'ui element id should be register')
  is_instance_of(ui.ledger_row_template, Element, 'ui should have a ledger row template element')
  equal(ui.locate(Register.UI.LEDGER_ROW_TEMPLATE_ID, ui.register_template, false), undefined, 'ledger row template should have been removed from main template')
  is_instance_of(ui.root, Element, 'ui should clone a root register element')
  ui.root.update('foo')
  ok(ui.register_template.innerHTML != 'foo')
})

test("register-ui-delegation", function() {
  expect(3)
  var ui = this.register.ui.initialize()
  strictEqual(ui.purchase_codes, this.register.purchase_codes)
  strictEqual(ui.payment_codes, this.register.payment_codes)
  strictEqual(ui.credit_codes, this.register.credit_codes)
})

test("register-ui-make-options", function() {
  expect(40)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes
  var cr = this.gold.credit_codes
  var ex =  [ 
    new Element('option', { value: pc[0].id }).update(pc[0].label),
    new Element('option', { value: pc[1].id }).update(pc[1].label),
    new Element('option', { value: pc[2].id }).update(pc[2].label),
  ]
  var options = ui.make_options(ui.purchase_codes, 'id', 'label')
  equal_elements(options, ex)
  options = ui.make_options(ui.purchase_codes, 'id', 'label', { value: 'default', label: 'Default' })
  ex.unshift(new Element('option', { value: 'default'}).update('Default'))
  equal_elements(options, ex)

  ex =  [ 
    new Element('option', { value: pc[0].id }).update(pc[0].code + ' (' + pc[0].label + ')'),
    new Element('option', { value: pc[1].id }).update(pc[1].code + ' (' + pc[1].label + ')'),
    new Element('option', { value: pc[2].id }).update(pc[2].code + ' (' + pc[2].label + ')'),
  ]
  options = ui.make_options(ui.purchase_codes, 'id', function(o) { return o.code + ' (' + o.label + ')' })
  equal_elements(options, ex)

   
  ex =  [ 
    new Element('optgroup', { label: 'Purchases' }).insert(
      new Element('option', { value: pc[0].id }).update(pc[0].label)
    ).insert(
      new Element('option', { value: pc[1].id }).update(pc[1].label)
    ).insert(
      new Element('option', { value: pc[2].id }).update(pc[2].label)
    ),
    new Element('optgroup', { label: 'Credits' }).insert(
      new Element('option', { value: cr[0].id }).update(cr[0].label)
    ).insert(
      new Element('option', { value: cr[1].id }).update(cr[1].label)
    ),
  ]
  options = ui.make_options({ Purchases: ui.purchase_codes, Credits: ui.credit_codes }, 'id', 'label')
  equal_elements(options, ex)
})

test("register-ui-initialize-with-payment", function() {
  expect(5)
  var ui = this.register.ui.initialize()
  $H(this.gold.payment).each(function(args) {
    var k = args[0]
    var v = args[1]
    equal(this.gold.payment[k], ui.find_payment_field(k, true).value)
  }, this)
})

test("register-ui-select-options", function() {
  expect(2)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes

  var ac = ui.purchase_codes_select.childElements()
  var message = "Expected " + (pc.length + 1) + " options but found " + ac.inspect()
  equal(ac.length, pc.length + 1, message)

  var ac = ui.payment_codes_select.childElements()
  var message = "Expected 3 optgroups but found " + ac.inspect()
  equal(ac.length, 3, message)
})

test("register-ui-initialize-purchase-code", function() {
  expect(5)
  var ui = this.register.ui.initialize()
  var pc = ui.purchase_codes_select
  var original_ui_row_count = ui.rows.length
  var fired = false
  ui.after_purchase_code_select = function() { fired = true } 
  fireEvent(pc, 'change')
  equal(fired, false)
  ui.purchase_amount_input.value = '100'
  fireEvent(pc, 'change')
  equal(fired, false)
  pc.value = '1'
  fireEvent(pc, 'change')
  equal(fired, false)
  ui.purchase_amount_input.value = '100'
  pc.value = '1'
  fireEvent(pc, 'change')
  equal(fired, true)
  equal(ui.rows.length, original_ui_row_count + 1)
})

test("register-ui-add-ledger-row", function() {
  expect(2)
  var ui = this.register.ui.initialize()
  var ledger = this.register.ledger
  var original_ledger_count = ledger.count() 
  var original_ui_row_count = ui.rows.length
  ui.add_ledger_row('1','40')
  equal(ledger.count(), original_ledger_count + 2, "purchase row and payment row")
  equal(ui.rows.length, original_ui_row_count + 1)
})

test("register-ui-row-enable-disable", function() {
  expect(5)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes[0]
  ui_lr = ui.add_ledger_row(pc.id, '50')
  equal(pc.debit_or_credit, "C")
  deepEqual(ui_lr.get_controls().pluck('disabled'), [true, false, false, false], "Debit control should be disabled because this row has a credit value.")
  ui_lr.disable()
  deepEqual(ui_lr.get_controls().pluck('disabled'), [true, true, true, true])
  ui_lr.enable()
  deepEqual(ui_lr.get_controls().pluck('disabled'), [false, false, false, false])
  ui_lr.reset_enable()
  deepEqual(ui_lr.get_controls().pluck('disabled'), [true, false, false, false])
})

test("register-ui-row-enable-disable-after-amount-flips", function() {
  expect(4)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes[0]
  ui_lr = ui.add_ledger_row(pc.id, '50')
  equal(pc.debit_or_credit, "C")
  deepEqual(ui_lr.get_controls().pluck('disabled'), [true, false, false, false], "Debit control should be disabled because this row has a credit value.")

  ui_lr.credit.value = '-50'
  fireEvent(ui_lr.credit, 'change')
  deepEqual(ui_lr.get_controls().pluck('disabled'), [false, true, false, false], "Now credit control should be disabled.")

  ui_lr.debit.value = '-25'
  fireEvent(ui_lr.debit, 'change')
  deepEqual(ui_lr.get_controls().pluck('disabled'), [true, false, false, false], "And back again.")
})

test("register-ui-row-values", function() {
  expect(4)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes[0]
  ui_lr = ui.add_ledger_row(pc.id, '50')
  equal(ui_lr.label.textContent, pc.label)
  equal(ui_lr.debit.value, '')
  equal(ui_lr.credit.value, '50.00')
  equal(ui_lr.detail.value, '')
})

test("register-ui-row-change-updates-ledger-row", function() {
  expect(6)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes[0]
  ui_lr = ui.add_ledger_row(pc.id, '50')
  lr = ui_lr.ledger_row
  ui_lr.credit.value = '100.55'
  fireEvent(ui_lr.credit, 'change')
  equal(lr.get_credit(), 10055)

  ui_lr.credit.value = '-50'
  fireEvent(ui_lr.credit, 'change')
  equal(lr.get_debit(), 5000)
  equal(ui_lr.debit.value, '50.00')

  ui_lr.debit.value = 'foo'
  fireEvent(ui_lr.debit, 'change')
  equal(ui_lr.last_alert, 'Please enter a number')
  equal(lr.get_debit(), 5000)
  equal(ui_lr.debit.value, '50.00')
})

test("register-ui-row-set-to-zero-destroys", function() {
  expect(2)
  var ui = this.register.ui.initialize()
  var ledger = this.register.ledger
  var pc = this.gold.purchase_codes[0]
  ui_lr = ui.add_ledger_row(pc.id, '50')
  var ledger_row_count = ledger.count()
  var ui_row_count = ui.rows.length
  ui_lr.credit.value = '0'
  fireEvent(ui_lr.credit, 'change')
  equal(ledger.count(), ledger_row_count - 2, "clears purchase and payment row")
  equal(ui.rows.length, ui_row_count - 1)
})

test("register-ui-row-validate", function() {
  expect(5)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes[2]
  ok(pc.require_detail)
  ui_lr = ui.add_ledger_row(pc.id, '100')
  ok(!ui_lr.validate())
  matches(ui_lr.errors.first(), /Detail is required/)
  ui_lr.set_detail('Foo')
  ok(ui_lr.validate())
  ok(ui_lr.errors.length == 0)
})

test("register-ui-sets-title", function() {
  expect(1)
  var ui = this.register.ui.initialize()
  equal(ui.root.down('.title').textContent, 'New Payment')
})

test("register-ui-cc-input", function() {
  expect(2)
  var ui = this.register.ui.initialize()
  ok(!ui.credit_card_input_popup.visible()) 
  ok(ui.credit_card_input.disabled)
})

test("register-ui-get-payment-type", function() {
  expect(2)
  var py = this.gold.payment_codes[0]
  var py2 = this.gold.payment_codes[1]
  var ui = this.register.ui.initialize()
  equal(ui.get_payment_type(), py.payment_type)
  ui.payment_codes_select.value = py2.id
  equal(ui.get_payment_type(), py2.payment_type)
})

test("register-ui-sets-payment-fields", function() {
  expect(2)
  var py = this.gold.payment_codes[1]
  var ui = this.register.ui.initialize()
  equal(ui.get_payment_fields().length, 10)
  ui.payment_codes_select.value = py.id
  ui.setup_payment_type_fields()
  equal(ui.get_payment_fields().length, 11)
})

test("register-ui-payment-type-select-sets-fields", function() {
  expect(2)
  var py = this.gold.payment_codes[1]
  var ui = this.register.ui.initialize()
  var py_select = ui.payment_codes_select
  equal(ui.get_payment_fields().length, 10)
  py_select.value = py.id
  fireEvent(py_select, 'change')
  equal(ui.get_payment_fields().length, 11)
})

test("register-ui-payment-type-select-sets-submission-controls", function() {
  expect(2)
  var py = this.gold.credit_card_code
  var ui = this.register.ui.initialize()
  var py_select = ui.payment_codes_select
  equal(ui.get_submission_controls().length, 1)
  py_select.value = py.id
  fireEvent(py_select, 'change')
  equal(ui.get_submission_controls().length, 3)
})

test("register-ui-sets-payment-code-default", function() {
  expect(1)
  var py = this.gold.payment_codes[0]
  var ui = this.register.ui.initialize()
  equal(ui.ledger.payment_code.id, py.id)
})

test("register-ui-totals", function() {
  expect(4)
  var ui = this.register.ui.initialize()
  equal(ui.total.textContent, '$0.00')
  equal(ui.tendered.value, '$0.00')
  equal(ui.credited.textContent,'$0.00')
  equal(ui.change.textContent,'$0.00')
})

test("register-ui-adding-purchase-row-updates-totals", function() {
  expect(10)
  var ui = this.register.ui.initialize()
  equal(ui.total.textContent, '$0.00')
  equal(ui.tendered.value, '$0.00')
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')

  add_purchase(ui, '100', '1')
  equal(ui.total.textContent, '$100.00')
  equal(ui.tendered.value, '$100.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')
})

test("register-ui-changing-amount-tendered-updates-totals", function() {
  expect(18)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '100', '1')
  equal(ui.total.textContent, '$100.00')
  equal(ui.tendered.value, '$100.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')

  change_tendered(ui, '50')
  equal(ui.total.textContent, '$100.00')
  equal(ui.tendered.value, '$50.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$-50.00')

  change_tendered(ui, '150')
  equal(ui.total.textContent, '$100.00')
  equal(ui.tendered.value, '$150.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$50.00')
})

test("register-ui-updating-purchase-row-updates-totals", function() {
  expect(12)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '100', '1')
  equal(ui.total.textContent, '$100.00')
  equal(ui.tendered.value, '$100.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')

  var lr = ui.rows.first()
  lr.credit.value = '50'
  ok(fireEvent(lr.credit, 'change'))
  equal(ui.total.textContent, '$50.00')
  equal(ui.tendered.value, '$50.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')
})

test("register-ui-adding-purchase-row-ignores-dollar-sign", function() {
  expect(6)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '$10.33', '1')
  equal(ui.total.textContent, '$10.33')
  equal(ui.tendered.value, '$10.33')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')
})

test("register-ui-updating-purchase-row-ignores-dollar-sign", function() {
  expect(7)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '100', '1')

  var lr = ui.rows.first()
  lr.credit.value = '$50'
  ok(fireEvent(lr.credit, 'change'))
  equal(ui.total.textContent, '$50.00')
  equal(ui.tendered.value, '$50.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')
})

test("register-ui-setting-amount-tendered-ignores-dollar-sign", function() {
  expect(8)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '18.99', '1')
  equal(ui.total.textContent, '$18.99')

  change_tendered(ui, '$20')
  equal(ui.total.textContent, '$18.99')
  equal(ui.tendered.value, '$20.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$1.01')
})

test("register-ui-setting-amount-tendered-with-cents", function() {
  expect(8)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '18.99', '1')
  equal(ui.total.textContent, '$18.99')

  change_tendered(ui, '$20.01')
  equal(ui.tendered.value, '$20.01')
  equal(ui.change.textContent, '$1.02')

  change_tendered(ui, '.01') 
  equal(ui.tendered.value, '$0.01')
  equal(ui.change.textContent, '$-18.98')
})

test("register-ui-deleting-purchase-row-updates-totals", function() {
  expect(13)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '100', '1')
  equal(ui.total.textContent, '$100.00')
  equal(ui.tendered.value, '$100.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')

  var lr = ui.rows.first()
  ok(fireEvent(lr.remove, 'click'))
  equal(ui.total.textContent, '$0.00')
  equal(ui.tendered.value, '$0.00')
  ok(!ui.credited_row.visible())
  ok(!ui.tendered_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')
})

test("register-ui-credit-totals", function() {
  expect(12)
  var ui = this.register.ui.initialize()
  add_purchase(ui, '100', '1')
  equal(ui.total.textContent, '$100.00')
  equal(ui.tendered.value, '$100.00')
  ok(!ui.credited_row.visible())
  equal(ui.credited.textContent, '$0.00')
  equal(ui.change.textContent, '$0.00')

  var lr = ui.rows.first()
  lr.credit.value = -50
  ok(fireEvent(lr.credit, 'change'))
  equal(ui.total.textContent, '$-50.00')
  equal(ui.tendered.value, '$0.00')
  ok(!ui.tendered_row.visible())
  equal(ui.credited.textContent, '$50.00')
  equal(ui.change.textContent, '$0.00')
})

test("register-ui-serialize", function() {
  expect(2)
  var ui = this.register.ui.initialize()
  ui.successful_submitter = ui.find_submission_control('record')
  var serialized = ui.serialize()
  deepEqual(serialized, {
    "payment[type]": "Cash",
    "payment[date(1i)]": "2011",
    "payment[date(2i)]": "3",
    "payment[date(3i)]": "29",
    "payment[user_id]": "",
    "payment[note]": "",
    "commit": "record"
  })
  ui.find_payment_field('payment_test_checkbox').checked = true
  ui.find_payment_field('payment_test_radio_2').checked = true
  serialized = ui.serialize()
  deepEqual(serialized, {
    "payment[test_checkbox]": "on",
    "payment[test_radio]": "2",
    "payment[type]": "Cash",
    "payment[date(1i)]": "2011",
    "payment[date(2i)]": "3",
    "payment[date(3i)]": "29",
    "payment[user_id]": "",
    "payment[note]": "",
    "commit": "record"
  })
})

test("register-ui-submit", function() {
  expect(15)
  var ui = this.register.ui.initialize()
  var register = this.register
  var serialized
  register.on_submit = function(event, serialized_form) {
    return serialized = serialized_form 
  }
  submit(ui, 'record')
  equal(ui.errors.length, 3)
  matches(ui.last_alert, /amount tendered/)
  matches(ui.last_alert, /no purchase codes/)
  matches(ui.last_alert, /required.*user_id/)
  is_undefined(serialized)

  ui.last_alert = undefined 
  add_purchase(ui, '100.99', '1')
  set_user_id(ui)
  submit(ui, 'record')
  equal(ui.errors.length, 0)
  is_undefined(ui.last_alert)
  deepEqual(serialized, {
    "commit": "record",
    "payment[type]": "Cash",
    "payment[date(1i)]": "2011",
    "payment[date(2i)]": "3",
    "payment[date(3i)]": "29",
    "payment[user_id]": "106",
    "payment[note]": "",
    "payment[ledger_entries_attributes][0][type]": "Income",
    "payment[ledger_entries_attributes][0][account_number]": "4210.000",
    "payment[ledger_entries_attributes][0][account_name]": "Store Purchase",
    "payment[ledger_entries_attributes][0][detail]": undefined,
    "payment[ledger_entries_attributes][0][register_code]": "ST",
    "payment[ledger_entries_attributes][0][debit_in_cents]": undefined,
    "payment[ledger_entries_attributes][0][credit_in_cents]": 10099,
    "payment[ledger_entries_attributes][0][code_label]": "Store Purchase",
    "payment[ledger_entries_attributes][0][code_type]": "purchase",
    "payment[ledger_entries_attributes][1][type]": "Asset",
    "payment[ledger_entries_attributes][1][account_number]": "1010.000",
    "payment[ledger_entries_attributes][1][account_name]": "Cash",
    "payment[ledger_entries_attributes][1][detail]": undefined,
    "payment[ledger_entries_attributes][1][register_code]": "CA",
    "payment[ledger_entries_attributes][1][debit_in_cents]": 10099,
    "payment[ledger_entries_attributes][1][credit_in_cents]": undefined,
    "payment[ledger_entries_attributes][1][code_label]": "Cash",
    "payment[ledger_entries_attributes][1][code_type]": "payment"
  })
  deepEqual(register.serialize(), {
    "commit": "record",
    "payment[type]": "Cash",
    "payment[date(1i)]": "2011",
    "payment[date(2i)]": "3",
    "payment[date(3i)]": "29",
    "payment[user_id]": "106",
    "payment[note]": "",
    "ledger_entries_attributes": [
      {
        "type": "Income",
        "account_number": "4210.000",
        "account_name": "Store Purchase",
        "detail": undefined,
        "register_code": "ST",
        "debit_in_cents": undefined,
        "credit_in_cents": 10099,
        "code_label": "Store Purchase",
        "code_type": "purchase"
      },
      {
        "type": "Asset",
        "account_number": "1010.000",
        "account_name": "Cash",
        "detail": undefined,
        "register_code": "CA",
        "debit_in_cents": 10099,
        "credit_in_cents": undefined,
        "code_label": "Cash",
        "code_type": "payment"
      },
    ],
  })
})

test("register-ui-validate-detail", function() {
  expect(5)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes[2]
  ok(pc.require_detail)
  add_purchase(ui, '100', pc.id)
  ui.validate()
  ok(ui.errors.length > 1)
  ok(ui.errors.join().match(/Detail is required/), 'Should have an error message for missing detail')
  ui.rows.first().set_detail('Foo')
  ui.validate()
  ok(!ui.errors.join().match(/Detail is required/), 'Should not have any detail missing messages')
})

test("register-submit-with-fractional-amounts", function() {
  expect(7)
  var ui = this.register.ui.initialize()
  var register = this.register
  var serialized
  register.on_submit = function(event, serialized_form) {
    return serialized = serialized_form 
  }

  add_purchase(ui, '10.37', 1)
  change_tendered(ui, '12')
  set_user_id(ui)
  submit(ui, 'record')
  equal(ui.errors.length, 0)
  change_credit = serialized["payment[ledger_entries_attributes][2][credit_in_cents]"]
  equal(change_credit, 163)
})

test("register-purchase-floating-point-zero", function() {
  expect(8)
  var ui = this.register.ui.initialize()
  var register = this.register
  var serialized
  register.on_submit = function(event, serialized_form) {
    return serialized = serialized_form 
  }

  add_purchase(ui, '10', 1)
  add_purchase(ui, '6.99', 1)
  // this can raise an uncaught exception when 10 + 16.99 ends up as 16.990000000000002
  // and the change becomes 0.000000000000008 which gets truncated to zero
  // This should no longer happen, because LedgerRow stores amount as integer cents now.
  set_user_id(ui)
  submit(ui, 'record')
  var s = register.serialize()
  var credits = s.ledger_entries_attributes.sum('credit_in_cents')
  var debits = s.ledger_entries_attributes.sum('debit_in_cents')
  equal(credits, 1699)
  equal(debits, 1699)
  equal(credits, debits)
})

test("register-ui-set-payment-code", function() {
  expect(2)
  var ui = this.register.ui.initialize()
  var ca = this.gold.payment_codes[0]
  var ch = this.gold.payment_codes[2] 
  equal(ui.payment_codes_select.getValue(), ca.id)
  ui.set_payment_code(ch) 
  equal(ui.payment_codes_select.getValue(), ch.id)
})

module("register-existing-payment", {
  setup: function() {
    this.gold = new GoldData()
    this.config = this.gold.edit_payment_register_config()
    this.config.payment = {
      'id' : 1,
      'type' : 'Cash',
    }
    this.register = new Register.Instance(this.config)
    this.ui = this.register.ui.initialize()
    this.ledger = this.register.ledger
  },
})

test("register-payment-payment-code", function() {
  expect(2)
  var payment = this.register.payment
  equal(payment.type, 'Cash')
  deepEqual(payment.code(), new Register.PaymentCode(this.gold.payment_codes[0], payment.code()))
})

test("register-ledger-reversing", function() {
  expect(1)
  ok(this.ledger.reversing())
})

test("register-ui-shows-existing-ledger", function() {
  expect(1)
  equal(this.ui.rows.size(), this.ledger.change_rows('old').size() + this.ledger.purchase_rows('old').size())
})

test("register-ui-existing-ledger-read-only", function() {
  expect(this.ui.rows.size())
  this.ui.rows.each(function(row) {
    equal(row.is_new(), false)
  })
})

test("register-validates-cannot-refund-more-than-payment", function() {
  expect(5)
  var st = this.gold.purchase_codes[0]
  var pr = this.gold.purchase_codes[1]
  var ledger_st = this.gold.ledger[2]
  var amount = ledger_st.credit
  equal(st.code, ledger_st.register_code)

  var errors = this.ledger.validate_reversal()
  equal(errors.length, 0)

  row = this.ledger.add_purchase(pr.id, -amount)

  errors = this.ledger.validate_reversal()
  equal(errors.length, 1)

  row.destroy()
  row = this.ledger.add_purchase(st.id, amount)

  errors = this.ledger.validate_reversal()
  equal(errors.length, 2)

  row.destroy()
  row = this.ledger.add_purchase(st.id, -amount)

  errors = this.ledger.validate_reversal()
  equal(errors.length, 0)
})

test("register-validates-reversal", function() {
  expect(4)
  var st = this.gold.purchase_codes[0]
  var pr = this.gold.purchase_codes[1]
  var ledger_st = this.gold.ledger[2]
  var amount = ledger_st.credit
  equal(st.code, ledger_st.register_code)

  row = this.ledger.add_purchase(pr.id, -amount)

  ok(!this.ledger.validate())
  equal(this.ledger.errors.length, 1)
  matches(this.ledger.errors[0], /no code PR.*original payment/)
})

test("register-existing-payment-sets-payment-type", function() {
  expect(1)
  this.config.payment = {
    'id' : 1,
    'type' : 'CreditCard',
  }
  this.register = new Register.Instance(this.config)
  this.ui = this.register.ui.initialize()
  this.ledger = this.register.ledger
  equal(this.ui.get_payment_type(), 'CreditCard')
})

test("register-payment-fields-disabled-for-partial-refund", function() {
  expect(2)
  this.config.payment = {
    'id' : 1,
    'type' : 'CreditCard',
  }
  this.register = new Register.Instance(this.config)
  this.ui = this.register.ui.initialize()
  this.ledger = this.register.ledger
  // Should just return date, user, notes
  equal(this.ui.get_payment_fields().length, 1)
  this.ui.get_payment_fields().each(function(field) {
    matches(field.id, /payment_note/)
  })
})

test("register-ui-amount-tendered-disabled-for-existing-payment", function() {
  expect(1)
  equal(this.ui.tendered.disabled, true)
})

test("register-ui-credit-card-swipe-handler-disabled-for-partial-refund", function() {
  expect(1)
  var ran = 'no'
  Register.UI.prototype.initialize_register_card_swipe = function() {
    ran = 'yes'
  }
  var register = new Register.Instance(this.config)
  var ui = register.ui.initialize()
  equal(ran, 'no')
})

module("register-module", {
  setup: function() {
    this.gold = new GoldData()
    this.config = this.gold.new_payment_register_config()
    this.edit_config = this.gold.edit_payment_register_config()
    this.edit_config["payment"] = $H(this.gold.payment).clone().toObject()
    this.edit_config["payment"]["id"] = 1
    this.register1 = Register.create(this.config)
    this.register2 = Register.create(this.edit_config)
  },
})

test("register-any-incomplete", function() {
  expect(3)
  ok(Register.any_incomplete())
  this.register1.canceled = true
  ok(Register.any_incomplete())
  Register.register_completed(this.register2.id())
  ok(!Register.any_incomplete())
})
