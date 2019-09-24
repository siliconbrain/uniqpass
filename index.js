const textEncoder = new TextEncoder('utf-8')

function arrayBufferToBase64(buffer) {
    return base64js.fromByteArray(new Uint8Array(buffer))
}

const defaultLimit = 44;

function computeUniqpass(secret, subject, limit) {
    if (secret !== "" && subject !== "") {
        return crypto.subtle.digest('SHA-256', textEncoder.encode(secret + subject))
            .then(arrayBufferToBase64)
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
        make,
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
        map: (variable, mapping) => make({
            get: mapping.getter(variable.get),
            set: mapping.setter(variable.set),
            listen: variable.listen,
        }),
    }
}()

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
        limit: document.getElementById('limit'),
        password: document.getElementById('password'),
        rememberPassword: document.getElementById('remember-secret'),
        secret: document.getElementById('secret'),
        subject: document.getElementById('subject'),
    }

    const controls = {
        limit: variable.map(
            variable.fromInputValue(form.limit),
            {
                getter: (get) => () => parseInt(get()),
                setter: (set) => (value) => set(value.toString()),
            }
        ),
        password: variable.fromInputValue(form.password),
        rememberSecret: variable.fromInputChecked(form.rememberPassword),
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

    combineLatest(controls.secret, controls.subject, controls.limit).listen(([secret, subject, limit]) => {
        computeUniqpass(secret, subject, limit).then((password) => {
            controls.password.set(password)
            if (controls.password.get() !== "") form.password.select()
        })
    })

    combineLatest(controls.subject, controls.limit).listen(([subject, limit]) => {
        const url = new URL(location)
        const params = url.searchParams
        if (subject !== "") {
            params.set('subject', subject)
        }
        if (limit !== defaultLimit) {
            params.set('limit', limit)
        }
        history.replaceState(null, "", url)
    })
})
