// This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html.

var Register = {
  version: '0.1.0',
  debug: false,
  registers: $H(),

  // Create a new Register.Instance from config and store it in the
  // Register.registers hash.
  create: function(config) {
    var register = new Register.Instance(config)
    this.registers.set(register.id(), register)
    return register
  },
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
      this.last_alert = message
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

  // Present a number as a dollar amount string with two decimal places.
  // If amount is not a number or a string which can be parsed as a number,
  // amount will be returned as is.
  // Default is without dollar sign.
  // monetize(45)         => '45.00'
  // monetize(34.0, true) => '$34.00'
  // monetize('.12')      => '0.12'
  // monetize('foo')      => 'foo'
  // monetize('')         => '' 
  // monetize(null)       => null
  // monetize(undefined)  => null
  monetize: function(input, dollar_sign) {
    var amount = parseFloat(input) 
    if (isNaN(amount)) {
      return input
    }
    var decimal = amount.toFixed(2)
    return (dollar_sign ? '$' : '') + decimal 
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
      this.name = type 
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
Register.Exceptions.generate_exception_type('RegisterException')
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
  this.__generate_code_index()
  this.ledger = new Register.Ledger(this, { rows: this.config.ledger })
  this.payment = new Register.Payment(this, this.config.payment)
  this.ui = new Register.UI(this, this.config.template)
}
Register.Instance.inherits(Register.Core)
// Constants
Register.Instance.NEW_MARKER = "__new__"
// Methods
Object.extend(Register.Instance.prototype, {
  // Payment identifier for this register or Register.Instance.NEW_MARKER if this is for a new payment.
  id: function() {
    return this.payment.id || Register.Instance.NEW_MARKER
  },

  // True if instance is for a new payment.
  is_new: function() {
    return this.id() === Register.Instance.NEW_MARKER 
  },

  // Register's root element.
  root: function() {
    return this.ui.root
  },

  // Lookup a purchase, payment, or credit code by unique id.
  find_code: function(code_id) {
    return this.code_index.get(code_id)
  },

  // Creates a Hash to index all of the purchase/payment/credit codes by id.
  // Will throw a RegisterException if two codes have the same id.
  __generate_code_index: function() {
    this.code_index = $H()
    var codes = $A([this.purchase_codes, this.payment_codes, this.credit_codes]).flatten().compact()
    codes.inject(this.code_index, function(index, code) {
      index.set(code.id, code)
      return index  
    })
    if (codes.size() != this.code_index.size()) {
      throw(new Register.Exceptions.RegisterException('__generate_code_index', "Overlapping code ids."))
    }
    return this.code_index
  },
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
  $A(['id', 'code', 'label', 'account_number', 'account_name', 'fee_types', 'account_type', 'debit_or_credit','payment_type']).each(configure)
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
  this.rows = $A()
  $A(this.config.rows || []).each(function(row_config) { this.add(row_config) }.bind(this))
}
Register.Ledger.inherits(Register.Core)
Object.extend(Register.Ledger.prototype, {
  // Number of ledger entries.
  count: function() { return this.rows.length },

  // Add a new LedgerRow for the given type, code and amount.
  // Throws Register.Exceptions.LedgerException if cannot determine a code from code_id.
  // Alternately, if passed a single object, it assumes it is a configuration object
  // for an existing LedgerRow and tries to instantiate from it.
  add: function(type, code_id, amount) {
    var new_row
    if (arguments.length == 1 && typeof(arguments[0]) == "object") {
      new_row = new Register.LedgerRow(arguments[0]) 
    } else {
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
    }
    this.rows.push(new_row)
    this.listen_for_destroy(new_row)
    return new_row
  },

  // Add a purchase LedgerRow.
  add_purchase: function(code_id, amount) { 
    return this.add(Register.LedgerRow.PURCHASE_TYPE, code_id, amount)
  },

  // Removes the given row from the ledger.
  remove: function(row) {
    this.rows.remove(this.rows.indexOf(row)) 
  },

  // Registers a remove call with the row's 'destroy' listener so that we remove
  // the row from the ledger when it is destroyed.
  listen_for_destroy: function(row) {
    if (!row.read_only) {
      row.add_listener('destroy', this.remove.bind(this))
    }
  },

  // Sets the payment Register.Code, resets the associated new payment
  // Ledger.Row and returns it.  Optionally can override the amount (default is
  // the new purchase total).  Overridden amounts must be equal to or greater
  // than the purchase total and must be associated with a cash payment code
  // type.
  set_payment_code: function(code_id, amount) {
    var new_code = this.register.payment_codes.lookup(code_id)
    if (this.payment_code != new_code) {
      this.__reset_payment()
    }
    return this.payment_row()
  },

  // Initializes the new payment and change row.  (Amount should only be 
  // given for cash payments.)
  __reset_payment: function(amount) {
    if (!this.payment_code) { return undefined }
    var purchase_amount = get_purchase_total('new')
    var payment_amount = amount || purchase_amount
    var change = payment_amount - purchase_amount
    if (change != 0 && !this.payment_code.is_cash()) { throw(new Register.Exceptions.LedgerException('__reset_payment', "Payment of #{amount} for non cash code #{payment_code} produced non-zero change #{change}", { amount: amount, payment_code: this.payment_code, change: change })) }
    this.__destroy_payment() 
    if (payment_amount) {
      return this.add(Register.LedgerRow.PAYMENT_TYPE, this.payment_code.id, payment_amount)
    }
    if (change) {
      return this.add(Register.LedgerRow.CHANGE_TYPE, this.payment_code.id, change)
    }
  },

  __destroy_payment: function() {
    if (this.payment_row()) { this.payment_row().destroy() }
    if (this.change_row()) { this.change_row().destroy() }
  },

  __rows_by_type: function(code_type, config) {
    config = config || {}
    var old_or_new = config['old_or_new']
    return this.rows.select(function(e) { 
      return e.code_type == code_type && (
        old_or_new == 'new' ?
          e.is_new() :
          old_or_new == 'old' ?
            !e.is_new() :
            true // either old or new
      )
    })
  },

  // Get the purchase rows, both old and new.
  // If you pass 'old' you will get only the old saved rows, if any.
  // If you pass 'new' you will get only the new unsaved rows.
  // The default is both.
  purchase_rows: function(old_or_new) {
    return this.__rows_by_type('purchase', old_or_new)
  },

  // Get the payment rows, both old and new.
  // Same options as purchase_rows.
  payment_rows: function(old_or_new) {
    return this.__rows_by_type('payment', old_or_new)
  },

  // Return the new payment row, if there is one.
  payment_row: function() {
    return this.payment_rows('new').first()
  },

  // Get the change rows, both old and new
  // Same options as purchase_rows.
  change_rows: function(old_or_new) {
    return this.__rows_by_type('change', old_or_new)
  },

  // Return the new change row, if there is one.
  change_row: function() {
    return this.change_rows('new').first()
  },

  // Total value of purchase ledger entries.
  // Same options as purchase_rows.
  get_purchase_total: function(old_or_new) {
    return this.purchase_rows(old_or_new).sum('get_amount')
  },

  // Total value of payment ledger entries.
  get_payment_total: function() {
    return this.payment_rows().sum('get_amount')
  },

  // Get the total amount tendered by the customer.
  get_tendered_total: function() {
    return this.payment_rows().sum('get_debit')
  },

  // Get the amount credited to the customer.
  get_credited_total: function() {
    var credited_total = this.payment_rows().sum('get_credit')
    return Object.isUndefined(credited_total) ? undefined : (-1 * credited_total)
  },

  // Get the change owed to the customer.
  get_change_total: function() {
    var change_total = this.change_rows().sum('get_amount')
    return Object.isUndefined(change_total) ? undefined : (-1 * change_total)
  },
})

/////////////////////
// Register.LedgerRow
/////////////////////

// A debit or credit associated with an account.
// Config may be an Object of raw ledger entry fields as returned by the server,
// or code_type, code and amount for new ledger rows.
//
// A config object of raw ledger row data should have:
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
    // Hash of arrays of callbacks for various potential events that other components can listen
    // for using add_listener()
    this.listeners = $H({ update: $A(), destroy: $A() })

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
      throw(new Register.Exceptions.LedgerRowException('initialize', "LedgerRow amount must be non-zero"))
    }

  },

  add_listener: function(event, callback) {
    var callbacks = this.listeners.get(event)
    if (!callbacks) { throw(new Register.Exceptions.LedgerRowException('add_listener', "Requested callback for unknown event '#{event}'\nCallback: #{callback}", { event: event, callback: callback })) }
    callbacks.push(callback)
    return this
  },

  fire: function(event) {
    $A(this.listeners.get(event)).each(function(callback) { callback(this) })
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

  // True if the ledger row is a debit amount.
  is_debit: function() {
    return this.debit ? true : false
  },

  get_credit: function() {
    return this.credit
  },

  set_credit: function(amount) {
    return this.__set_amount(amount, 'credit')    
  },

  // True if the ledger row is a credit amount.
  is_credit: function() {
    return this.credit ? true : false
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
    return value
  },

  // Unless row is read_only, updates the given field with the requested value
  // through it's setter method, then fires 'update' callbacks.
  update: function(name, value) {
    if (this.read_only) { return false }
    var result = this["set_" + name](value)
    this.fire('update')
    return result
  },

  // Unless row is read_only, Fires 'destroy' callbacks and deletes the
  // instance.
  destroy: function() {
    if (this.read_only) { return false }
    this.fire('destroy')
    return true
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

    var result
    switch (type) {
      case 'credit':
        result = setter(amount, 'debit'); break
      case 'debit':
        result = setter(amount, 'credit'); break
      default: throw( new Register.Exceptions.LedgerRowException('__set_amount', "Invalid type: #{type}", { type: type }))
    }
    
    return result
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
Register.UI.PAYMENT_FIELDS_ID = 'payment-fields'
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
      // isolate other important elements
      this.ledger_entries = this.locate(Register.UI.LEDGER_ENTRIES_ID)
      this.purchase_amount_input = this.locate(Register.UI.PURCHASE_AMOUNT_INPUT_ID)
      this.payment_fields = this.locate(Register.UI.PAYMENT_FIELDS_ID)
      // populate select controls with codes
      this.purchase_codes_select = this.locate(Register.UI.PURCHASE_CODES_SELECT_ID)
      this.update_from_array(this.purchase_codes_select, this.make_options(this.purchase_codes, 'id', 'label', { value: Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE, label: '- Select a code -' }))
      this.payment_codes_select = this.locate(Register.UI.PAYMENT_CODES_SELECT_ID)
      this.update_from_array(this.payment_codes_select, this.make_options(this.payment_codes, 'id', 'label'))
      // initialize callback functions in the root register so that it will respond to
      // user actions
      this.initialize_register_callbacks()
      // set the register's title header
      this.set_title()
      // set visible payment fields
      this.setup_payment_type_fields()
    }
  },

  // Returns an Array of the visible payment fields.
  get_payment_fields: function() {
    return this.payment_fields.select('input','select','textarea').findAll(function(e) {
      return !e.disabled
    })
  },

  // Returns the payment code object associated with the currently selected payment type.
  get_payment_code: function() {
    return this.register.find_code(this.payment_codes_select.value)
  },

  // Returns the current payment_type string value as determined by the setting
  // of the payment-type select control.
  get_payment_type: function() {
    return this.get_payment_code().payment_type
  },

  // Hides or shows and enables or disables payment fields based on the
  // currently selected payment type.
  setup_payment_type_fields: function() {
    var payment_type = this.get_payment_type()
    this.payment_fields.select('.show-by-type').each(function(e) {
      e.hide()
      e.select('input','select','textarea').invoke('disable')
    })
    this.payment_fields.select('.show-by-type.' + payment_type).each(function(e) {
      e.select('input','select','textarea').invoke('enable')
      e.show()
    })
  },

  set_title: function() {
    var title = this.register.is_new() ? "New Payment" : "Payment #" + this.register.id()
    this.root.down('.title').update(title)
    return title 
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

  remove_ledger_row: function(ui_row) {
    this.rows.remove(this.rows.indexOf(ui_row))
  },

  // Clear purchase amount, set purchase codes to default and move focus back to
  // purchase amount.
  reset_ledger_entry_input_controls: function() {
    this.purchase_amount_input.value = null 
    this.purchase_codes_select.value = Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE
    this.purchase_amount_input.activate()
  },

  // Callback for user choosing an entry in the purchase code select.
  // XXX Is there a good reason to add callbacks around the UI events?  Rather than
  // callbacks around core register events like totals updates?
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

  // Callback for user changing the payment type.
  handle_payment_code_select: function(evnt) {
    this.setup_payment_type_fields() 
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
    this.initialize_payment_code_controls()     
  },

  // Attaches onchange callback to UI purchase-code select to add new ledger rows.
  initialize_purchase_code_controls: function() {
    this.purchase_codes_select.observe('change', this.handle_purchase_code_select.bind(this))
  },

  // Attaches onchange callback to UI payment-type select to change the payment type and
  // show/hide associated fields.
  initialize_payment_code_controls: function() {
    this.payment_codes_select.observe('change', this.handle_payment_code_select.bind(this))
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
Register.UI.Row.DEBIT_SELECTOR = '.debit-row-control'
Register.UI.Row.CREDIT_SELECTOR = '.credit-row-control'
Register.UI.Row.DETAIL_SELECTOR = '.detail-row-control'
Register.UI.Row.REMOVE_SELECTOR = '.remove-row-control'
// Methods
Object.extend(Register.UI.Row.prototype, {
  initialize: function() {
    this.label = this.locate(Register.UI.Row.LABEL_SELECTOR)
    this.initialize_input('debit')
    this.initialize_input('credit')
    this.initialize_input('detail')
    this.initialize_input('remove')
    this.ledger_row.add_listener('update', this.update.bind(this))
    this.ledger_row.add_listener('destroy', this.destroy.bind(this))
    this.initialize_callbacks()
    this.update()
  },

  // Initializes the specified input control with meta data and helper functions for
  // callbacks.
  initialize_input: function(name) {
    var selector = Register.UI.Row[name.toUpperCase() + "_SELECTOR"]
    var input = this[name] = this.locate(selector)
    input.ui_row = this
    input.ledger_field_name = name
    if (name == 'credit' || name == 'debit') {
      input.is_a_credit_or_debit_field = true
    }

    // If row is read-only, inputs should be disabled.
    // A debit or credit field should only enable if the row is a debit or credit.
    input.allow_enable = function() {
      var ledger_row = this.ui_row.ledger_row
      var enable_allowed = true
      if (ledger_row.read_only ||
         (this.is_a_credit_or_debit_field &&
          !ledger_row["is_" + this.ledger_field_name]())) {
        enable_allowed = false
      }
      return enable_allowed
    }

    input.reset_enable = function() {
      this.allow_enable() ?
        this.enable() :
        this.disable()
      return input
    }

    return input 
  },

  // Set the row's html field values from the internal ledger_row values.
  update: function() {
    this.label.update(this.ledger_row.get_label())
    this.__set('debit', true)
    this.__set('credit', true)
    this.__set('detail')
    this.reset_enable()
    return this
  },

  // Set the given input from the internal ledger_row state.
  // Null or undefined values will be set as the empty string.
  // Non-null numbers will be monetized if monetize_value is set true.
  __set: function(name, monetize_value) {
    var value = this.ledger_row["get_" + name]()
    value = value || ''
    this[name].value = monetize_value ? this.monetize(value) : value
    return this
  },

  // Returns an Array of the row's form controls.
  get_controls: function() {
    return this.root.select('input','select','textarea')
  },

  // Reset the row's form controls to be either enabled or disabled based on state.
  // (Whether they are read-only or empty debit or credit inputs)
  reset_enable: function() {
    this.get_controls().invoke('reset_enable')
  },

  // Enable all of the row's form controls.
  enable: function() {
    this.get_controls().invoke('enable')
  },

  // Disable all of the row's form controls.
  disable: function() {
    this.get_controls().invoke('disable')
  },

  // Setup the event callbacks for the row's controls.
  initialize_callbacks: function() {
    this.remove.observe('click', this.handle_remove.bind(this))
    $A(['credit', 'debit', 'detail']).each(function(control) {
      this[control].observe('change', this.handle_update)
    }.bind(this))
  },

  handle_remove: function(evnt) {
    this.ledger_row.destroy()
  },

  // Not bound to UI.Row because we want the Input.value and this
  // handle is generic to all the text Input elements in the row.
  handle_update: function(evnt) {
    var ui_row = this.ui_row
    var ledger_row = ui_row.ledger_row
    if (this.is_a_credit_or_debit_field) {
      var numeric_value = parseFloat(this.value)
      if (this.value.empty() || numeric_value == 0) {
        return ledger_row.destroy()
      } else if (isNaN(numeric_value)) {
        ui_row.alert_user("Please enter a number")
        ui_row.__set(this.ledger_field_name, true)
        return false
      }
    }
    return ledger_row.update(this.ledger_field_name, this.value)
  },

  // Remove the row from the ledger and destroy it.
  destroy: function() {
    this.root.remove() // remove from Document
    this.ui.remove_ledger_row(this)
    return true
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

/////////////////////////
// Array methods 
/////////////////////////

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
}

// Sums all the elements of an array.
//
// If a property is passed, each element is tested for the property.
//
// If it exists, and is a function, then it is called and the returned value is added.
//
// If it exists, but is not a function, then it is added.
//
// Otherwise, the element itself is added.
//
// Each value is coerced with parseFloat().  If the result is NaN it
// is excluded from the sum.
//
// (The default property to be tested is 'value' if none is given)
//
// The sum of an empty array is undefined.
//
// Examples:
//
//   [].sum() // => undefined
//   [1,2,3].sum() // => 6
//   ['1','2','foo'].sum() // => 3
//   [{ value: 2 }, { value: 5 }, { value: 3}].sum() // => 10
//   [{ amount: '1' }, { amount: '2' }, {}].sum('amount') // => 3
//
Array.prototype.sum = function(property_name) {
  if (this.length == 0) { return undefined }
  property_name = property_name || 'value'
  return this.inject(0, function(sum, v) {
    var value
    var property = v[property_name]
    switch (typeof(property)) {
      case 'undefined': value = v; break
      case 'function': value = v[property_name](); break
      default: value = property
    }
    value = parseFloat(value)
    return (isNaN(value) ? sum : (sum + value))
  })
}
