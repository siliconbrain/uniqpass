const textEncoder = new TextEncoder('utf-8')

function arrayBufferToBase64(buffer) {
    return base64js.fromByteArray(new Uint8Array(buffer))
}

const defaultLimit = 44;

function getExcludePattern(exclude) {
    const parts = []
    if (!!exclude.upper) {
        parts.push('A-Z')
    }
    if (!!exclude.lower) {
        parts.push('a-z')
    }
    if (!!exclude.number) {
        parts.push('0-9')
    }
    if (!!exclude.symbol) {
        parts.push('+/=')
    }
    return new RegExp('[' + parts.join('') + ']', 'g')
}

function computeUniqpass(secret, subject, limit, exclude) {
    if (secret !== "" && subject !== "") {
        return crypto.subtle.digest('SHA-256', textEncoder.encode(secret + subject))
            .then(arrayBufferToBase64)
            .then(pass => pass.replace(getExcludePattern(exclude), ''))
            .then(pass => pass.substring(0, limit || undefined))
    }
    return Promise.resolve("")
}

const secretStorageKey = "secret"

function loadValuesFromStorage(controls) {
    const storedSecret = localStorage.getItem(secretStorageKey)
    if (storedSecret !== null) {
        controls.secret.set(storedSecret)
        controls.rememberSecret.set(true)
    }
}

function loadValuesFromURL(controls) {
    const params = new URLSearchParams(location.search)

    if (params.has('limit')) {
        const limitString = params.get('limit')
        const limitValue = parseInt(limitString)
        if (isNaN(limitValue)) {
            console.warn("'limit' parameter set to invalid value:", limitString)
        } else {
            controls.limit.set(limitValue)
        }
    }

    const subjectValue = params.get('subject')
    if (subjectValue) {
        controls.subject.set(subjectValue)
    }

    const exclude = params.get('ex')
    if (exclude) {
        Object.entries({
            'l': controls.charsetLower,
            'n': controls.charsetNumber,
            's': controls.charsetSymbol,
            'u': controls.charsetUpper,
        }).forEach(([key, control]) => control.set(!exclude.includes(key)))
    }
}

const variable = function() {

    const make = ({get, set, listen}) => {
        let listening = false
        const listeners = []
        const onChange = () => {
            const value = get()
            listeners.forEach((listener) => listener(value))
        }
        return {
            get,
            set: value => {
                set(value)
                onChange()
            },
            listen: (listener) => {
                listeners.push(listener)
                listener(get())  // send current value
                if (!listening) {
                    listen(onChange)
                    listening = true
                }
            },
        }
    }

    return {
        fromInputValue: (input) => make({
            get: () => input.value,
            set: (value) => { input.value = value },
            listen: (listener) => input.addEventListener('change', listener),
        }),
        fromInputChecked: (input) => make({
            get: () => input.checked,
            set: (value) => { input.checked = value },
            listen: (listener) => input.addEventListener('change', listener),
        }),
        make,
        map: (variable, mapping) => make({
            get: mapping.getter(variable.get),
            set: mapping.setter(variable.set),
            listen: variable.listen,
        }),
    }
}()

const listenable = {
    fromButtonClick: (button) => ({
        listen: (listener) => button.addEventListener('click', () => listener()),
    }),
    map: (transform) => (listenable) => ({
        listen: (listener) => listenable.listen((value) => listener(transform(value))),
    }),
}

function combineLatest(...listenables) {
    let listening = false
    const listeners = []

    const waitingFor = new Set(Array(listenables.length).keys())
    const latest = []
    return {
        listen: (listener) => {
            listeners.push(listener)
            if (!listening) {
                listenables.forEach((listenable, idx) => listenable.listen((value) => {
                    latest[idx] = value
                    waitingFor.delete(idx)
                    if (waitingFor.size === 0) {
                        listeners.forEach(listener => listener([...latest]))
                    }
                }))
                listening = true
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = {
        charsetLower: document.getElementById('charset-lower-input'),
        charsetNumber: document.getElementById('charset-number-input'),
        charsetSymbol: document.getElementById('charset-symbol-input'),
        charsetUpper: document.getElementById('charset-upper-input'),
        limit: document.getElementById('limit-input'),
        password: document.getElementById('password-input'),
        passwordToClipboard: document.getElementById('password-to-clipboard'),
        rememberPassword: document.getElementById('remember-secret-input'),
        resetLimit: document.getElementById('reset-limit'),
        secret: document.getElementById('secret-input'),
        subject: document.getElementById('subject-input'),
    }

    const controls = {
        charsetLower: variable.fromInputChecked(form.charsetLower),
        charsetNumber: variable.fromInputChecked(form.charsetNumber),
        charsetSymbol: variable.fromInputChecked(form.charsetSymbol),
        charsetUpper: variable.fromInputChecked(form.charsetUpper),
        limit: variable.map(
            variable.fromInputValue(form.limit),
            {
                getter: (get) => () => parseInt(get()),
                setter: (set) => (value) => set(value.toString()),
            }
        ),
        password: variable.fromInputValue(form.password),
        passwordToClipboard: listenable.fromButtonClick(form.passwordToClipboard),
        rememberSecret: variable.fromInputChecked(form.rememberPassword),
        resetLimit: listenable.fromButtonClick(form.resetLimit),
        secret: variable.fromInputValue(form.secret),
        subject: variable.fromInputValue(form.subject),
    }

    loadValuesFromStorage(controls)

    loadValuesFromURL(controls)

    if (form.secret.value === "") {
        form.secret.focus()
    } else if (form.subject.value === "") {
        form.subject.focus()
    } else {
        form.password.focus()
    }

    combineLatest(controls.secret, controls.rememberSecret).listen(([secret, remember]) => {
        if (remember) {
            localStorage.setItem(secretStorageKey, secret)
        } else {
            localStorage.removeItem(secretStorageKey)
        }
    })

    const charsetExclude = listenable.map(([charsetLower, charsetNumber, charsetSymbol, charsetUpper]) => ({
        lower: !charsetLower,
        number: !charsetNumber,
        symbol: !charsetSymbol,
        upper: !charsetUpper,
    }))(combineLatest(controls.charsetLower, controls.charsetNumber, controls.charsetSymbol, controls.charsetUpper))

    combineLatest(controls.secret, controls.subject, controls.limit, charsetExclude).listen(([secret, subject, limit, exclude]) => {
        computeUniqpass(secret, subject, limit, exclude).then((password) => {
            controls.password.set(password)
            if (controls.password.get() !== "") form.password.select()
        })
    })

    combineLatest(controls.subject, controls.limit, charsetExclude).listen(([subject, limit, exclude]) => {
        const url = new URL(location)
        const params = url.searchParams
        if (subject !== "") {
            params.set('subject', subject)
        }

        params.set('limit', limit)

        const ex = Object.entries(exclude).reduce((acc, [key, value]) => value ? acc + key[0] : acc, '')
        if (ex === "") {
            params.delete('ex')
        } else {
            params.set('ex', ex)
        }

        history.replaceState(null, "", url)
    })

    controls.resetLimit.listen(() => controls.limit.set(defaultLimit))

    controls.passwordToClipboard.listen(() => navigator.clipboard.writeText(controls.password.get()))
})
