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
  var code_data = this.gold.purchase_codes[0]
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
}),

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
    credit: '10',
  })
  is_instance_of(lr, Register.LedgerRow)
  // accessors
  strictEqual(lr.get_credit(), 10)
  ok(lr.is_credit())
  is_undefined(lr.get_debit())
  ok(!lr.is_debit())
  strictEqual(lr.get_amount(), 10)
  equal(lr.get_label(), pc.label)
  is_undefined(lr.get_detail())
  // other properties
  equal(lr.type, pc.account_type)
  equal(lr.account_number, pc.account_number)
  equal(lr.account_name, pc.account_name)
  equal(lr.register_code, pc.code)
  equal(lr.code_type, 'purchase')
})

test("register-ledger-row-bad-initialization", function() {
  expect(4)
  var pc = this.gold.purchase_codes[0]
  var config = $H({
    code_type: 'purchase',
    code: pc,
    credit: '10',
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
      new Register.LedgerRow(config.merge({debit: 10}).toObject())
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
})

test("register-ledger-row-initialize-from-existing", function() {
  expect(13)
  var ldata1 = this.gold.ledger[1]
  var lr = new Register.LedgerRow(ldata1)
  is_instance_of(lr, Register.LedgerRow)
  // accessors
  strictEqual(lr.get_debit(), parseFloat(ldata1.debit))
  ok(lr.is_debit())
  is_undefined(lr.get_credit())
  ok(!lr.is_credit())
  strictEqual(lr.get_amount(), parseFloat(ldata1.debit))
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
  expect(20)
  var pc = this.gold.purchase_codes[0]
  var config = {
    code_type: 'purchase',
    code: pc,
    credit: '10',
  }
  var lr = new Register.LedgerRow(config)
  strictEqual(lr.get_credit(), 10.0)
  is_undefined(lr.get_debit())
  ok(lr.is_credit())
  ok(!lr.is_debit())
  strictEqual(lr.get_amount(), 10.0)

  lr.set_credit('15')
  strictEqual(lr.get_credit(), 15.0)
  is_undefined(lr.get_debit())
  ok(lr.is_credit())
  ok(!lr.is_debit())
  strictEqual(lr.get_amount(), 15.0)

  lr.set_debit('6')
  is_undefined(lr.get_credit())
  strictEqual(lr.get_debit(), 6.0)
  ok(!lr.is_credit())
  ok(lr.is_debit())
  strictEqual(lr.get_amount(), -6.0)

  lr.set_debit('-15.5')
  strictEqual(lr.get_credit(), 15.5)
  is_undefined(lr.get_debit())
  ok(lr.is_credit())
  ok(!lr.is_debit())
  strictEqual(lr.get_amount(), 15.5)
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
  equal(ledger.get_purchase_total(), 32)
  equal(ledger.get_payment_total(), 40)
  equal(ledger.get_tendered_total(), 40)
  equal(ledger.get_credited_total(), 0)
  equal(ledger.get_change_total(), 8)
  equal(ledger.get_credits_total(), 40)
  equal(ledger.get_debits_total(), 40)
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
  expect(6)
  var ledger = this.register.ledger
  strictEqual(ledger.get_amount_tendered_or_credited(), 0)
  ledger.set_amount_tendered('100')
  strictEqual(ledger.get_amount_tendered_or_credited(), 100)
  ledger.set_amount_tendered(55)
  strictEqual(ledger.get_amount_tendered_or_credited(), 55)
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
  expect(31)
  var ui = this.register.ui.initialize()
  var pc = this.gold.purchase_codes
  var cr = this.gold.credit_codes
  var ex =  [ 
    new Element('option', { value: pc[0].id }).update(pc[0].label),
    new Element('option', { value: pc[1].id }).update(pc[1].label),
  ]
  var options = ui.make_options(ui.purchase_codes, 'id', 'label')
  equal_elements(options, ex)
  options = ui.make_options(ui.purchase_codes, 'id', 'label', { value: 'default', label: 'Default' })
  ex.unshift(new Element('option', { value: 'default'}).update('Default'))
  equal_elements(options, ex)

  ex =  [ 
    new Element('option', { value: pc[0].id }).update(pc[0].code + ' (' + pc[0].label + ')'),
    new Element('option', { value: pc[1].id }).update(pc[1].code + ' (' + pc[1].label + ')'),
  ]
  options = ui.make_options(ui.purchase_codes, 'id', function(o) { return o.code + ' (' + o.label + ')' })
  equal_elements(options, ex)

   
  ex =  [ 
    new Element('optgroup', { label: 'Purchases' }).insert(
      new Element('option', { value: pc[0].id }).update(pc[0].label)
    ).insert(
      new Element('option', { value: pc[1].id }).update(pc[1].label)
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
  equal(lr.get_credit(), 100.55)

  ui_lr.credit.value = '-50'
  fireEvent(ui_lr.credit, 'change')
  equal(lr.get_debit(), 50)
  equal(ui_lr.debit.value, '50.00')

  ui_lr.debit.value = 'foo'
  fireEvent(ui_lr.debit, 'change')
  equal(ui_lr.last_alert, 'Please enter a number')
  equal(lr.get_debit(), 50)
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

test("register-ui-sets-title", function() {
  expect(1)
  var ui = this.register.ui.initialize()
  equal(ui.root.down('.title').textContent, 'New Payment')
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
  equal(ui.get_payment_fields().length, 6)
  ui.payment_codes_select.value = py.id
  ui.setup_payment_type_fields()
  equal(ui.get_payment_fields().length, 7)
})

test("register-ui-payment-type-select-sets-fields", function() {
  expect(2)
  var py = this.gold.payment_codes[1]
  var ui = this.register.ui.initialize()
  var py_select = ui.payment_codes_select
  equal(ui.get_payment_fields().length, 6)
  py_select.value = py.id
  fireEvent(py_select, 'change')
  equal(ui.get_payment_fields().length, 7)
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
  add_purchase(ui, '100', '1')
  set_user_id(ui)
  submit(ui, 'record')
  equal(ui.errors.length, 0)
  is_undefined(ui.last_alert)
  deepEqual(serialized, {
    "commit": "Record",
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
    "payment[ledger_entries_attributes][0][debit]": undefined,
    "payment[ledger_entries_attributes][0][credit]": 100,
    "payment[ledger_entries_attributes][0][code_label]": "Store Purchase",
    "payment[ledger_entries_attributes][0][code_type]": "purchase",
    "payment[ledger_entries_attributes][1][type]": "Asset",
    "payment[ledger_entries_attributes][1][account_number]": "1010.000",
    "payment[ledger_entries_attributes][1][account_name]": "Cash",
    "payment[ledger_entries_attributes][1][detail]": undefined,
    "payment[ledger_entries_attributes][1][register_code]": "CA",
    "payment[ledger_entries_attributes][1][debit]": 100,
    "payment[ledger_entries_attributes][1][credit]": undefined,
    "payment[ledger_entries_attributes][1][code_label]": "Cash",
    "payment[ledger_entries_attributes][1][code_type]": "payment"
  })
  deepEqual(register.serialize(), {
    "commit": "Record",
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
        "debit": undefined,
        "credit": 100,
        "code_label": "Store Purchase",
        "code_type": "purchase"
      },
      {
        "type": "Asset",
        "account_number": "1010.000",
        "account_name": "Cash",
        "detail": undefined,
        "register_code": "CA",
        "debit": 100,
        "credit": undefined,
        "code_label": "Cash",
        "code_type": "payment"
      },
    ],
  })
})
