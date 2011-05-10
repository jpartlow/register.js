function pretty_print(object) {
  var debug = "{ "
  for (var property in object) {
    if (typeof object[property] != 'function') {
      debug += property + " : " + object[property] + ", " 
    }
  }
  print(debug + "}")
}

function fireEvent(element,event){
  if (document.createEventObject){
    // dispatch for IE
    var evt = document.createEventObject();
    return element.fireEvent('on'+event,evt)
  }
  else{
    // dispatch for firefox + others
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent(event, true, true ); // event type,bubbling,cancelable
    return element.dispatchEvent(evt);
  }
}

function is_instance_of(object, function_ref, message) {
  var def_msg = object + ' should be an instanceof ' + function_ref
  ok(object instanceof function_ref, $A(message,def_msg).join(" : "))
}

function is_undefined(object, message) {
  message = message || object + ' should be undefined'
  ok(typeof(object) == 'undefined', message)
}

function is_null(object, message) {
  message = message || object + ' should be null'
  ok(object === null, message)
}

function matches(string, regexp, message) {
  message = (message ? message : '') + "Unable to match: '" + regexp + "'\nin: '" + string + "'"
  ok(string.match(regexp), message)
}

// deepEqual fails when comparing Prototype Elements
function equal_element(actual, expected, deep) {
  var message = "Expected: " + expected.toString() + " but was " + actual.toString()
  equal(actual.toString(), expected.toString(), message)
  message = "Expected " + expected.attributes.length + " attributes but found " + actual.attributes.length
  equal(actual.attributes.length, expected.attributes.length, message)
  $A(expected.attributes).each(function(ex) {
    ac = actual.attributes[ex.name]
    message = "Expected attribute '" + ex.name + "' to be '" + ex.value + "' but found: '" + ac.value + "'"
    equal(ac.value, ex.value, message)
  })
  if (deep) {
    message = "Expected innerHTML: " + expected.innerHTML + "\n but was: " + actual.innerHTML
    equal(actual.innerHTML, expected.innerHTML, message)
  }
}

function equal_elements(actual, expected, deep) {
  var message = "Expected " + expected.length + " elements but found " + actual.length
  message = message + "\nExpected: " + expected.inspect() + "\nActual: " + actual.inspect()
  equal(actual.length, expected.length, message)
  $A(actual).zip(expected).each(function(pair) {
    equal_element(pair[0], pair[1], deep)
  })
}

function add_purchase(ui, amount, code) {
  var pc = ui.purchase_codes_select
  var am = ui.purchase_amount_input
  am.value = amount
  pc.value = code
  ok(fireEvent(pc, 'change'), 'payment select change event failed for add_purchase')
  return true
}

function change_tendered(ui, amount) {
  ui.tendered.value = amount
  ok(fireEvent(ui.tendered, 'change'), 'amount tendered change event failed for change_tendered')
  return true
}

function set_field(ui, field_id, value) {
  var field = ui.find_payment_field(field_id)
  field.value = value
  ok(fireEvent(field, 'change'), 'change event for ' + field_id + ' failed for set_field')
  return true
}

function set_user_id(ui, value) {
  var user_id = ui.find_payment_field('user_id')
  value = value || user_id.options[1].value
  set_field(ui, 'user_id', value)
}

function submit(ui, action) {
  var control = ui.find_submission_control(action)
  ok(fireEvent(control, 'click'), 'click event for ' + action + ' submit control failed for submit()')
  ok(!fireEvent(ui.form, 'submit'), 'submit event for form not cancelled for submit()')
  return true
}

// Reinitializes gold data for test configuration and comparisons.
function GoldData() {

  this.track_data = {
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
  
  this.purchase_codes = [
    {
      id: 1,
      code: "ST",
      label: "Store Purchase",
      account_number: "4210.000",
      account_name: "Store Purchase",
      fee_types: [],
      account_type: "Income",
      debit_or_credit: "C",
      allow_detail: true,
    },
    {
      id: 2,
      code: "PR",
      label: "Personal Retreat",
      account_number: "4100.000",
      account_name: "Personal Retreat",
      fee_types: ["guaranteed_privacy", "lodging"],
      account_type: "Income",
      debit_or_credit: "C",
      allow_detail: true,
    },
  ]

  this.payment_codes = [
    {
      id: 13,
      code: "CA",
      label: "Cash",
      account_number: "1010.000",
      account_name: "Cash",
      fee_types: [],
      payment_type: "Cash",
      account_type: "Asset",
      debit_or_credit: "D",
      allow_detail: false,
      allows_change: true,
    },
    {
      id: 14,
      code: "CVT",
      label: "Credit Voucher Payment",
      account_number: "2251.000",
      account_name: "Credit Vouchers",
      payment_type: "CreditVoucher",
      account_type: "Liability",
      debit_or_credit: "D",
      allow_detail: false,
    },
    {
      id: 15,
      code: "CH",
      label: "Check",
      account_number: "1900.000",
      account_name: "Undeposited Funds",
      payment_type: "Check",
      account_type: "Asset",
      debit_or_credit: "D",
      allow_detail: false,
      allows_change: true,
    },
    {
      id: 16,
      code: "CCT",
      label: "Credit Card",
      account_number: "1900.000",
      account_name: "Undeposited Funds",
      payment_type: "CreditCard",
      account_type: "Asset",
      debit_or_credit: "D",
      allow_detail: false,
      allows_change: true,
    },
  ]

  this.credit_card_code = this.payment_codes[3]

  this.credit_codes = [
    {
      id: 20,
      code: "CVTC",
      label: "Issue Credit Voucher",
      account_number: "2251.000",
      account_name: "Credit Vouchers",
      payment_type: "CreditVoucher",
      account_type: "Liability",
      debit_or_credit: "C",
      allow_detail: false,
    },
    {
      id: 21,
      code: "GCTC",
      label: "Gift Certificate Credit",
      account_number: "2250.000",
      account_name: "Gift Certificates",
      payment_type: "GiftCertificate",
      account_type: "Liability",
      debit_or_credit: "C",
      allow_detail: false,
    },
  ]

  this.adjustment_codes = [
    {
      id: -1,
      code: "CMP",
      label: "Comp",
    },
  ]

  this.payment = {
    credit_card_first_name: 'Foo',
    credit_card_last_name: 'Bar',
    credit_card_billing_address: '123 Street',
    credit_card_zip_code: '12345',
    check_phone: '123-456-7890',
  }

  this.ledger = [
    {
      id: 38,
      type: "Asset",
      account_number: "1010.000",
      account_name: "Cash",
      debit: null,
      credit: 8.0,
      detail: '',
      register_code: "CA",
      code_label: "Change",
      code_type: "change",
    },
    {
      id: 37,
      type: "Asset",
      account_number: "1010.000",
      account_name: "Cash",
      debit: 40.0,
      credit: null,
      detail: '',
      register_code: "CA",
      code_label: "Cash",
      code_type: "payment",
    },
    {
      id: 36,
      type: "Income",
      account_number: "4210.000",
      account_name: "Store Purchase",
      debit: null,
      credit: 32.0,
      detail: '',
      register_code: "ST",
      code_label: "Store Purchase",
      code_type: "purchase",
    },
  ]

  this.template = this.extract_register_template()
  this.payment_template = this.extract_payment_template()
}
GoldData.prototype = {
  new_payment_register_config: function() {
    return {
      purchase_codes: this.purchase_codes,
      payment_codes: this.payment_codes,
      adjustment_codes: this.adjustment_codes,
      credit_codes: this.credit_codes,
      payment: this.payment,
      template: this.template,
    }
  },

  edit_payment_register_config: function() {
    return {
      purchase_codes: this.purchase_codes,
      payment_codes: this.payment_codes,
      adjustment_codes: this.adjustment_codes,
      credit_codes: this.credit_codes,
      payment: this.payment,
      ledger: this.ledger,
      template: this.template,
    }
  },

  extract_register_template: function() {
    return this.extract_template('register', 'register_template', true)
  },

  extract_payment_template: function() {
    return this.extract_template('test-payment-template', 'test_payment_template', false)
  },

  extract_template: function(id, property, serialize) {
    if (typeof GoldData[property] == 'undefined') {
      var template = $(id)
      if (template) {
        template.remove()
        if (serialize) {
          // serialize as a string
          var wrapper = new Element('div').update(template)
          GoldData[property] = wrapper.innerHTML
        } else {
          // just reference the removed element
          GoldData[property] = template
        }
      }
    }
    return GoldData[property]
  }
}
