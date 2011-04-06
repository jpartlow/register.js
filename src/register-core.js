// This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html.

var Register = {
  version: '0.1.0',
  debug: false,
}

//////////////////////
// Simple Inheritance
//////////////////////
Function.prototype.inherits = function(parent_function) { 
  this.prototype = new parent_function
  this.prototype.constructor = this
  this.prototype.parent = parent_function.prototype
  return this
} 

///////////////////
// Register.Core
///////////////////

// Methods available to all Register.<Object> instances.
Register.Core = function() {
}
Register.Core.prototype = {
  // Given a constructor method, maps an array of configuration data into an
  // array of constructor instances.
  //
  // The returned Prototype Array is extended with a lookup() function to assist
  // with finding elements by their 'id' property.
  initialize_array_of: function(element_function, config_array) {
    var array = $A(config_array).map(function(config) { return new element_function.prototype.constructor(config) } )
    Object.extend(array, {
      lookup: function(key) {
        if (Object.isUndefined(this.__index)) {
          this.index = this.inject($H(), function(hash, e) {
            hash.set(e.id, e)
            return hash
          })
        }
        return this.index.get(key)
      },
    })
    return array
  },

  alert_user: function(message) {
    if (Register.debug) {
      this.log(message)
    } else {
      alert(message)
    }
  },

  log: function(message) {
    if (typeof console !== 'undefined') {
      console.log("Register: " + message)
    }
  },

  // Locate by an id string or selector string, in the Document, or in passed
  // element.  This method should be used for locating required elements in the
  // register's html template.
  //
  // locate('foo') // finds #foo in current context or Document
  // locate('.bar') // finds first .bar in current context or Document
  //
  // Note that because a bar string is being interpreted as an id string, you cannot
  // locate the first element of a given type.  locate('div') will search for '#div'.
  // Since the point of this function is only to lookup uniquely id'd or classed
  // elements within a given context, this shouldn't matter.
  //
  // If this object has a this.root property pointing to an Element, then it
  // will be used as a default context instead of the Document if no context is
  // given.
  //
  // Throws Register.Exceptions.MissingElementException if not found unless
  // loudly is set false.
  locate: function(selector, context, loudly) {
    var quietly = loudly === false ? true : false
    context = context || (this.root instanceof Element ? this.root : null)
    var selector_is_an_id_string = selector.match(/^[\w\d_-]+$/) == null ? false : true
    var element
    if (selector_is_an_id_string) {
      element = (context ?
        context.down("#" + selector) :
        $(selector)
      )
    } else {
      element = (context ?
        context.down(selector) :
        $$(selector).first()
      )
    }
    if (Object.is_null_or_undefined(element) && !quietly) {
      throw( new Register.Exceptions.MissingElementException(selector, context) ) 
    } else if (element) {
      return element 
    }
    return undefined 
  },

  // Update an element's innerHTML from an array of elements and/or html strings.
  // Returns the element for chaining.
  update_from_array: function(element, array) {
    element.update()
    $A(array).each(function(e) {
      element.insert(e)
    })
    return element
  },
}

///////////////////////
// Register.Exceptions
//////////////////////
Register.Exceptions = {
  BaseException: function() {},

  generate_exception_type: function(type) {
    var constructor = Register.Exceptions[type] = function(method, msg, macros) {
      macros = macros || {}
      this.name = name
      this.message = this.name + "." + method + " failed.\n"
      if (msg) {
        this.message = this.message + msg.interpolate(macros) 
      }
    }
    constructor.prototype = new Register.Exceptions.BaseException()
    return constructor
  },

  MissingElementException: function(selector, element) {
    this.name = "MissingElementException"
    this.message = "Unable to find " + selector + " in " + element
  },
}  
Register.Exceptions.generate_exception_type('LedgerException')
Register.Exceptions.generate_exception_type('LedgerRowException')
Register.Exceptions.MissingElementException.prototype = new Register.Exceptions.BaseException()

/////////////////////
// Register.Instance
/////////////////////

// A Register.Instance is the primary handle for an active register.
//
// Expects to be passed a configuration Object with:
//
// * purchase_codes : Array of raw purchase Code data
// * payment_codes : Array of raw payment Code data
// * credit_codes : Array of raw credit Code data
// * ledger : Array of raw LedgerRow data
// * payment : Object of raw Payment data
// * template : String representing the register template XHTML
//
Register.Instance = function(config) {
  this.config = config || {}
  this.purchase_codes = this.initialize_array_of(Register.Code, this.config.purchase_codes)
  this.payment_codes = this.initialize_array_of(Register.Code, this.config.payment_codes)
  this.credit_codes = this.initialize_array_of(Register.Code, this.config.credit_codes)
  this.ledger = new Register.Ledger(this, this.config.ledger)
  this.payment = new Register.Payment(this, this.config.payment)
  this.ui = new Register.UI(this, this.config.template)
}
Register.Instance.inherits(Register.Core)
Object.extend(Register.Instance.prototype, {
})

/////////////////////
// Register.Code
/////////////////////

// A Register.Code represents one code that a user of the register would
// use to code a particular purchase, payment or credit line item.
Register.Code = function(config) {
  this.config = config || {}
  var configure = function(field) {
    this[field] = this.config[field]
  }.bind(this)
  $A(['id', 'code', 'label', 'account_number', 'account_name', 'fee_types', 'account_type', 'debit_or_credit']).each(configure)
}
Register.Code.inherits(Register.Core)
Object.extend(Register.Code.prototype, {
})

/////////////////////
// Register.Ledger
/////////////////////

// The Register.Ledger is the collection of all ledger entries which
// collectively will make up the accounting transaction being processed by this
// payment.
Register.Ledger = function(register, config) {
  this.register = register
  this.config = config || {}
  this.rows = this.initialize_array_of(Register.LedgerRow, this.config.rows)
}
Register.Ledger.inherits(Register.Core)
Object.extend(Register.Ledger.prototype, {
  // Number of ledger entries.
  count: function() { return this.rows.length },

  // Add a new LedgerRow for the given type, code and amount.
  // Throws Register.Exceptions.LedgerException if cannot determine a code from code_id.
  add: function(type, code_id, amount) {
    var code = this.register.purchase_codes.lookup(code_id)
    if (!code) { throw(new Register.Exceptions.LedgerException('add', 'Cannot add a new row to the Ledger without a Register.Code')) }

    var debit, credit
    switch (code.debit_or_credit) {
      case 'D': debit = amount; break
      case 'C': credit = amount; break
      default: throw(new Register.Exceptions.LedgerException('add', "Register.Code.debit_or_credit of unknown type: '#{type}'", { type: code.debit_or_credit }))
    }
    var new_row = new Register.LedgerRow({
      code_type: type,
      code: code,
      debit: debit,
      credit: credit,
    })
    this.rows.push(new_row)
    return new_row
  },

  // Add a purchase LedgerRow.
  add_purchase: function(code_id, amount) { 
    return this.add(Register.LedgerRow.PURCHASE_TYPE, code_id, amount)
  },

})

/////////////////////
// Register.LedgerRow
/////////////////////

// A debit or credit associated with an account.
// Config may be an Object of raw ledger entry fields as returned by the server,
// or code_type, code and amount for new ledger rows.
//
// An config object of raw ledger row data should have:
// * id: unique id for the row
// * type: GL account type (Asset, Liability, Income or Expense)
// * account_number: GL account number string ('1000.000' for example)
// * account_name: longhand GL account name
// * detail: a string with detail information about the row
// * register_code: unique shorthand code associated with the Register.Code
//   that generated this row (this is different than the GL account_code or
//   account_name, since multiple register codes might be tied to the same
//   account)
// * debit: debit amount
// * credit: credit amount
// * code_label: the longhand label associated with the Register.Code that generated this row
// * code_type: purchase, payment or change
// * read_only: (boolean) Existing ledger rows returned by the server may be
//   marked read-only if they are ledger entries which have already been
//   processed.  This is as opposed to unsaved ledger entries returned during
//   creation of a new payment due to validation errors.
//
// NOTE: Only debit or credit should have a value, not both.  
//
// The reason an existing ledger row
// configuration contains all of the account code/register code information directly rather
// than just referencing a Register.Code the way a new instance does, is because we may be
// making an adjustment to an existing payment from the past, and register codes may
// have been reconfigured since then.
//
// Generating a new LedgerRow from code would expect:
// * code_type: as above
// * code: a Register.Code instance
// * debit: debit amount OR
// * credit: credit amount
//
// NOTE: only one of either debit or credit should be present.
//
// Throws Register.Exceptions.LedgerRowException if both debit, credit are set, if amount is 0
// or not a number, or if the code_type is not one of Register.LedgerRow.TYPES.
Register.LedgerRow = function(config) {
  this.config = config || {}
  this.code = this.config.code || {}
  this.initialize()
}
Register.LedgerRow.inherits(Register.Core)
// Constants
Register.LedgerRow.PURCHASE_TYPE = 'purchase'
Register.LedgerRow.PAYMENT_TYPE = 'payment'
Register.LedgerRow.CHANGE_TYPE = 'change'
Register.LedgerRow.TYPES = $A([Register.LedgerRow.PURCHASE_TYPE, Register.LedgerRow.PAYMENT_TYPE, Register.LedgerRow.CHANGE_TYPE])
// Methods
Object.extend(Register.LedgerRow.prototype, {
  initialize: function() {
    // set defaults from either this.config or this.code if available
    var set_default = function (args) {
      var fields = $A([args]).flatten()
      var ledger_row_field_name = fields[0]
      var code_field_name = fields[1] || ledger_row_field_name
      this[ledger_row_field_name] = this.config[ledger_row_field_name] || this.code[code_field_name]
    }.bind(this)
    $A([
      // LedgerRow.field_name, Code.field_name
      ['type', 'account_type'],
      'account_number',
      'account_name',
      ['register_code', 'code'],
      ['code_label', 'label'],
      'detail',
      'code_type',
    ]).each(set_default)

    if (!Register.LedgerRow.TYPES.include(this.code_type)) {
      throw(new Register.Exceptions.LedgerRowException('initialize', "Cannot initialize a LedgerRow whose code_type is not in Register.LedgerRow.TYPES: '#{type}'", { type: this.code_type }))
    } else if (this.config.credit && this.config.debit) {
      throw(new Register.Exceptions.LedgerRowException('intialize', "Cannot initialize a LedgerRow with both credit (#{credit}) and debit (#{debit}) values.", { credit: this.config.credit, debit: this.config.debit }))
    }

    this.read_only = this.config.read_only || false
    var amount
    if (amount = this.config.debit) { this.set_debit(amount) }
    if (amount = this.config.credit) { this.set_credit(amount) }
    if (this.get_amount() == 0) {
      throw(new Register.Exceptions.LedgerRowException('initialize', "LedgerRow amount must be a non-zero"))
    }
  },

  get_label: function() {
    return this.code_label
  },

  get_debit: function() {
    return this.debit 
  },

  set_debit: function(amount) {
    return this.__set_amount(amount, 'debit')    
  },

  get_credit: function() {
    return this.credit
  },

  set_credit: function(amount) {
    return this.__set_amount(amount, 'credit')    
  },

  // Returns the credit or debit amount as a signed amount depending on account type.
  // (For Asset and Expense accounts, debits are positive; for Liability and Income
  // accounts, credits are positive.)
  get_amount: function() {
    var amount
    var getter = function (type) {
      var reverse = type == 'debit' ? 'credit' : 'debit'
      var value = this[type] ? this[type] : -1 * this[reverse]
      return value || 0
    }.bind(this)
    switch (this.type) {
      case 'Asset': case 'Expense': amount = getter('debit'); break
      case 'Liability': case 'Income': amount = getter('credit'); break
      default: throw( new Register.Exceptions.LedgerRowException('amount', "No account type matches: #{type}", { type: this.type }))
    }
    return amount
  },

  get_detail: function() {
    return this.detail
  },

  set_detail: function(value) {
    this.detail = value
  },

  __set_amount: function(raw_amount, type) {
    var amount = parseFloat(raw_amount) 
    if (isNaN(amount)) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Attempted to set #{type} but amount #{amount} is not a number.", { type: type, amount: amount }))
    } else if (amount == 0) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Cannot set a LedgerRow amount to zero."))
    }
    var setter = function (amount, reverse) {
      if (amount < 0) {
        amount = -amount
        this[type] = undefined
        this[reverse] = amount
      } else {
        this[type] = amount
        this[reverse] = undefined
      }
      return amount
    }.bind(this)
    switch (type) {
      case 'credit':
        return setter(amount, 'debit')
      case 'debit':
        return setter(amount, 'credit')
      default: throw( new Register.Exceptions.LedgerRowException('__set_amount', "Invalid type: #{type}", { type: type }))
    }
  },
})

/////////////////////
// Register.Payment
/////////////////////

// General information about the payment.
Register.Payment = function(register, config) {
  this.register = register
  this.config = config || {}
}
Register.Payment.inherits(Register.Core)

/////////////////////
// Register.UI
/////////////////////

// Provides the HTML and events for user interaction with the register.
Register.UI = function(register, template) {
  this.register = register
  this.purchase_codes = register.purchase_codes
  this.payment_codes = register.payment_codes
  this.credit_codes = register.credit_codes
  this.template_source = template || ''
  this.initialize()
}
Register.UI.inherits(Register.Core)
// Constants
Register.UI.LEDGER_ENTRIES_ID = 'ledger-entries'
Register.UI.LEDGER_ROW_TEMPLATE_ID = 'ledger-entry-row-template'
Register.UI.PAYMENT_CODES_SELECT_ID = 'payment-type'
Register.UI.PURCHASE_AMOUNT_INPUT_ID = 'purchase-amount'
Register.UI.PURCHASE_CODES_SELECT_ID = 'purchase-code'
Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE = '*Blank*'
// Methods
Object.extend(Register.UI.prototype, {
  initialize: function() {
    var wrapper = new Element('div').update(this.template_source)
    this.register_template = wrapper.childElements().first()
    this.rows = $A()
    if (this.register_template) {
      // isolate ledger_row_template and set the root register element
      this.ledger_row_template = this.locate(Register.UI.LEDGER_ROW_TEMPLATE_ID, this.register_template).remove()
      this.root = this.register_template.cloneNode(true)
      this.ledger_entries = this.locate(Register.UI.LEDGER_ENTRIES_ID)
      this.purchase_amount_input = this.locate(Register.UI.PURCHASE_AMOUNT_INPUT_ID)
      // populate select controls with codes
      this.purchase_codes_select = this.locate(Register.UI.PURCHASE_CODES_SELECT_ID)
      this.update_from_array(this.purchase_codes_select, this.make_options(this.purchase_codes, 'id', 'label', { value: Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE, label: '- Select a code -' }))
      this.payment_codes_select = this.locate(Register.UI.PAYMENT_CODES_SELECT_ID)
      this.update_from_array(this.payment_codes_select, this.make_options(this.payment_codes, 'id', 'label'))
      // initialize callback functions in the root register so that it will respond to
      // user actions
      this.initialize_register_callbacks()
    }
  },

  // Generate and return a set of select options.  One option is generated for each object in
  // the passed array.
  make_options: function(array, value_method, label_method, default_option_values) {
    var default_option, options
    if (default_option_values) {
      default_option = new Element('option', { value: default_option_values.value }).update(default_option_values.label)
    } 
    options = $A(array).map(function(o) {
      var value = Object.__send(o, value_method)
      var label = Object.__send(o, label_method)
      return new Element('option', { value: value }).update(label)
    })
    if (default_option) { options.unshift(default_option) }
    return options
  },

  add_ledger_row: function(code_id, amount) {
    var ledger_row = this.register.ledger.add_purchase(code_id, amount)
    var ui_row = (new Register.UI.Row(this, ledger_row))
    this.rows.push(ui_row)
    this.ledger_entries.insert(ui_row.root)
    return ui_row
  },

  // Clear purchase amount, set purchase codes to default and move focus back to
  // purchase amount.
  reset_ledger_entry_input_controls: function() {
    this.purchase_amount_input.value = null 
    this.purchase_codes_select.value = Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE
    this.purchase_amount_input.activate()
  },

  // Callback for user choosing an entry in the purchase code select.
  handle_purchase_code_select: function(evnt) {
    if (this.before_purchase_code_select && !this.before_purchase_code_select()) {
      evnt.stop()
    } else {
      var amount = this.purchase_amount_input.value
      var code_id = this.purchase_codes_select.value
      if (isNaN(parseFloat(amount))) {
        this.alert_user("Please enter an amount")
      } else if (isNaN(code_id)) {
        // do not attempt to add -- default code row selected.
      } else {
        this.add_ledger_row(code_id, amount)
        if (this.after_purchase_code_select) { this.after_purchase_code_select() }
      }
      this.reset_ledger_entry_input_controls()
    }
  },

  // Initializes callback functions on user controls in the current root register ui.
  // * purchase-code select - on change create a ledger row, update totals
  // * payment-type select - on change update register payment state and hide/show
  //   correct payment fields.
  // * ledger row value - on change flip credit/debit if switch from positive to negative,
  //   delete if zero, update totals
  // * ledger row remove - on click remove ledger row, update totals
  // * amount-tendered - on change update totals
  // * card swipe - key logger to detect and handle card swipe
  // * tabbing - keep tab cycle within register
  // * submission - validate before submit
  initialize_register_callbacks: function() {
    this.initialize_purchase_code_controls()     
  },

  // Attaches onchange callback to UI purchase-code select to add new ledger rows.
  initialize_purchase_code_controls: function() {
    this.purchase_codes_select.observe('change', this.handle_purchase_code_select.bind(this))
  },

})

// Provides the HTML and events for user interaction with a ledger row in the register.
Register.UI.Row = function(ui, ledger_row) {
  this.ui = ui
  this.ledger_row = ledger_row
  this.root = this.ui.ledger_row_template.cloneNode(true)
  this.initialize()
}
Register.UI.Row.inherits(Register.Core)
// Constants
Register.UI.Row.LABEL_SELECTOR = '.label'
Register.UI.Row.DEBIT_SELECTOR = '.debit'
Register.UI.Row.CREDIT_SELECTOR = '.credit'
Register.UI.Row.DETAIL_SELECTOR = '.detail'
Register.UI.Row.REMOVE_SELECTOR = '.remove-row-control'
// Methods
Object.extend(Register.UI.Row.prototype, {
  initialize: function() {
    this.label = this.locate(Register.UI.Row.LABEL_SELECTOR)
    this.debit = this.locate(Register.UI.Row.DEBIT_SELECTOR)
    this.credit = this.locate(Register.UI.Row.CREDIT_SELECTOR)
    this.detail = this.locate(Register.UI.Row.DETAIL_SELECTOR)
    this.remove = this.locate(Register.UI.Row.REMOVE_SELECTOR)
    this.remove.observe('click', this.handle_remove.bind(this))
    this.update()
  },

  // Set the row's html field values from the internal ledger_row values.
  update: function() {
    this.label.update(this.ledger_row.get_label())
    this.debit.update(this.ledger_row.get_debit())
    this.credit.update(this.ledger_row.get_credit())
    this.detail.update(this.ledger_row.get_detail())
  },

  handle_remove: function(evnt) {
    this.remove() 
  },

  // Remove the row from the ledger.
  remove: function() {
    throw('implement Register.UI.Row.remove()')
  },
})

/////////////////////////

// Object Utilities
/////////////////////////
Object.extend(Object, {
  is_null_or_undefined: function(object) {
    return object === null || typeof(object) == 'undefined'
  },

  // Looks up the given property on the given object.  If it is a function, applies
  // it with the given array of arguments and returns the value, otherwise just
  // returns the value.
  __send: function(object, property, args) {
    var value = object[property]
    if (typeof(value) == 'function') {
      value = value.apply(object, args)
    }
    return value
  },
})
