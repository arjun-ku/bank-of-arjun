/**
 * Bank of Piggo - Main Logic with Firebase
 */

const firebaseConfig = {
    apiKey: "AIzaSyDEhAH1DxWugB5fkUZUhi0IYqqFk0LceLI",
    authDomain: "bank-of-arjun.firebaseapp.com",
    projectId: "bank-of-arjun",
    storageBucket: "bank-of-arjun.firebasestorage.app",
    messagingSenderId: "998590863555",
    appId: "1:998590863555:web:46a6a0f4069e1780c4ea76",
    measurementId: "G-YKG1YQH622"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

const app = {
    state: {
        users: [],
        currentUser: null,
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.initAuthListener();
        this.initRealtimeListener();
    },

    initAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log("User logged in:", user.email);
                // User is signed in, fetch their extra data from Firestore
                const userDoc = await db.collection('users').doc(user.email).get();

                if (userDoc.exists) {
                    app.state.currentUser = { ...userDoc.data(), email: user.email };
                    app.ui.showScreen('dashboard');
                    app.ui.renderDashboard(app.state.currentUser);
                } else {
                    // Start fresh flow if doc missing (shouldn't happen usually)
                    app.state.currentUser = { email: user.email, role: null, balance: 0 };
                    app.ui.renderTemplate('roleSelection');
                    app.ui.showScreen('dashboard');
                }
            } else {
                console.log("User logged out");
                app.state.currentUser = null;
                app.ui.showScreen('welcome');
            }
        });
    },

    cacheDOM() {
        this.dom = {
            screens: {
                welcome: document.getElementById('welcome-screen'),
                signup: document.getElementById('signup-screen'),
                login: document.getElementById('login-screen'),
                dashboard: document.getElementById('dashboard-screen')
            },
            forms: {
                signup: document.getElementById('signup-form'),
                login: document.getElementById('login-form'),
                linkParent: document.getElementById('link-parent-form'),
                transaction: document.getElementById('transaction-form'),
                setPin: document.getElementById('set-pin-form'),
                allowance: document.getElementById('allowance-form')
            },
            modals: {
                overlay: document.getElementById('modal-overlay'),
                linkParent: document.getElementById('link-parent-modal'),
                transaction: document.getElementById('transaction-modal'),
                setPin: document.getElementById('set-pin-modal'),
                allowance: document.getElementById('allowance-modal')
            },
            dashboardContent: document.getElementById('dashboard-content'),
            templates: {
                roleSelection: document.getElementById('role-selection-template'),
                parentDashboard: document.getElementById('parent-dashboard-template'),
                kidDashboard: document.getElementById('kid-dashboard-template')
            }
        };
    },

    bindEvents() {
        // Navigation Buttons
        document.getElementById('btn-create-profile').onclick = () => this.ui.showScreen('signup');
        document.getElementById('btn-existing-account').onclick = () => this.ui.showScreen('login');
        document.querySelectorAll('.back-btn').forEach(btn => btn.onclick = () => this.ui.showScreen('welcome'));

        // Auth Forms
        this.dom.forms.signup.onsubmit = (e) => this.handlers.handleSignup(e);
        this.dom.forms.login.onsubmit = (e) => this.handlers.handleLogin(e);
        document.getElementById('btn-google-signup').onclick = () => this.handlers.handleGoogleSignup();
        document.getElementById('btn-logout').onclick = () => this.handlers.handleLogout();

        // Modal Forms
        this.dom.forms.linkParent.onsubmit = (e) => this.handlers.handleLinkParent(e);
        this.dom.forms.transaction.onsubmit = (e) => this.handlers.handleTransaction(e);
        this.dom.forms.setPin.onsubmit = (e) => this.handlers.handleSetPin(e);
        this.dom.forms.allowance.onsubmit = (e) => this.handlers.handleSetAllowance(e);
    },

    initRealtimeListener() {
        // Listen to the 'users' collection in real-time
        db.collection('users').onSnapshot((snapshot) => {
            const users = [];
            snapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() });
            });
            app.state.users = users;

            // If logged in, update UI with fresh data
            if (auth.currentUser && app.state.currentUser) {
                // Find self in the updated list
                const freshData = app.state.users.find(u => u.email === auth.currentUser.email);
                if (freshData) {
                    app.state.currentUser = freshData;
                    // Only re-render if visible
                    if (!document.getElementById('dashboard-screen').classList.contains('hidden')) {
                        app.ui.renderDashboard(freshData);
                    }
                }
            }
        });
    },

    data: {
        async createUserDoc(user) {
            // Use EMAIL as doc ID
            await db.collection('users').doc(user.email).set(user);
        },
        async updateUser(user) {
            await db.collection('users').doc(user.email).update(user);
        },
        findUser(email) {
            return app.state.users.find(u => u.email === email);
        },
        getKidsForParent(parentEmail) {
            return app.state.users.filter(u => {
                if (u.role !== 'kid') return false;
                // Support both legacy single parent and new array
                if (u.linkedParents && Array.isArray(u.linkedParents)) {
                    return u.linkedParents.includes(parentEmail);
                }
                return u.linkedParent === parentEmail;
            });
        }
    },

    handlers: {
        async handleSignup(e) {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();

            try {
                // 1. Create Auth User
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 2. Create Firestore Doc
                const newUserDoc = {
                    email: user.email,
                    username: user.email.split('@')[0], // Default username from email
                    role: null,
                    balance: 0,
                    linkedParent: null
                };

                await app.data.createUserDoc(newUserDoc);
                // Auth listener will auto-redirect to dashboard
            } catch (err) {
                console.error("Signup Error:", err);
                alert(err.message);
            }
        },

        async handleGoogleSignup() {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await auth.signInWithPopup(provider);
                const user = result.user;

                // Check if doc exists, if not create it
                const doc = await db.collection('users').doc(user.email).get();
                if (!doc.exists) {
                    const newUserDoc = {
                        email: user.email,
                        username: user.displayName || user.email.split('@')[0],
                        role: null,
                        balance: 0,
                        linkedParent: null
                    };
                    await app.data.createUserDoc(newUserDoc);
                }
                // Auth listener handles the rest
            } catch (err) {
                console.error("Google Sign In Error:", err);
                alert(err.message);
            }
        },

        handleLogout() {
            auth.signOut();
        },

        async selectRole(role) {
            if (role === 'parent') {
                // Check if PIN exists
                if (!app.state.currentUser.bankPin) {
                    app.ui.openModal('setPin');
                } else {
                    app.state.currentUser.role = 'parent';
                    await app.data.updateUser(app.state.currentUser);
                }
            } else {
                // Kid needs to link to a parent
                app.ui.openModal('linkParent');
            }
        },

        async handleSetPin(e) {
            e.preventDefault();
            const pin = document.getElementById('set-pin-input').value.trim();
            if (pin.length !== 4 || isNaN(pin)) {
                alert("PIN must be 4 digits");
                return;
            }

            app.state.currentUser.role = 'parent';
            app.state.currentUser.bankPin = pin;
            await app.data.updateUser(app.state.currentUser);
            app.ui.closeModals();
        },

        async handleLinkParent(e) {
            e.preventDefault();
            const parentEmail = document.getElementById('parent-link-email').value.trim();
            const parentPin = document.getElementById('parent-link-pin').value.trim();

            const parentUser = app.state.users.find(u => u.email === parentEmail && u.role === 'parent');

            if (parentUser) {
                if (parentUser.bankPin !== parentPin) {
                    alert("Incorrect Parent PIN!");
                    return;
                }

                app.state.currentUser.role = 'kid';
                // Initialize array if needed
                if (!app.state.currentUser.linkedParents) {
                    app.state.currentUser.linkedParents = [];
                }
                // Add if not already linked
                if (!app.state.currentUser.linkedParents.includes(parentEmail)) {
                    app.state.currentUser.linkedParents.push(parentEmail);
                }

                await app.data.updateUser(app.state.currentUser);

                app.ui.closeModals();
                alert(`Successfully linked to ${parentUser.username || parentUser.email}!`);
            } else {
                alert('Parent account not found! Ensure email is correct.');
            }
        },

        showAllowanceModal(kidEmail, currentAllowance) {
            const kid = app.data.findUser(kidEmail);
            if (!kid) return;

            document.getElementById('allowance-kid-email').value = kidEmail;
            document.getElementById('allowance-kid-name').innerText = `Set Allowance for ${kid.username}`;
            document.getElementById('allowance-amount').value = currentAllowance || 0;
            app.ui.openModal('allowance');
        },

        async handleSetAllowance(e) {
            e.preventDefault();
            const kidEmail = document.getElementById('allowance-kid-email').value;
            const amount = parseInt(document.getElementById('allowance-amount').value);

            const kid = app.data.findUser(kidEmail);
            if (kid) {
                kid.allowance = amount;
                await app.data.updateUser(kid);
                app.ui.closeModals();
            }
        },

        // Transaction Logic
        currentTransactionType: null, // 'add' or 'remove'

        showTransactionModal(type) {
            this.currentTransactionType = type;
            const title = type === 'add' ? 'Deposit Money' : 'Withdraw Money';
            document.getElementById('transaction-title').innerText = title;

            // Populate kids dropdown
            const select = document.getElementById('transaction-kid-select');
            select.innerHTML = '<option value="" disabled selected>Select Kid</option>';

            const kids = app.data.getKidsForParent(app.state.currentUser.email);

            if (kids.length === 0) {
                alert("No kids linked yet! Ask your kid to create a profile and link to you.");
                return;
            }

            kids.forEach(kid => {
                const opt = document.createElement('option');
                opt.value = kid.email;
                opt.innerText = `${kid.username} (Bal: $${kid.balance})`;
                select.appendChild(opt);
            });

            app.ui.openModal('transaction');
        },

        async handleTransaction(e) {
            e.preventDefault();
            const kidEmail = document.getElementById('transaction-kid-select').value;
            const amount = parseInt(document.getElementById('transaction-amount').value);

            if (!kidEmail || !amount) return;

            const kid = app.data.findUser(kidEmail);
            if (!kid) return;

            if (this.currentTransactionType === 'add') {
                kid.balance += amount;
            } else {
                if (kid.balance < amount) {
                    alert("Insufficient funds in account!");
                    return;
                }
                kid.balance -= amount;
            }

            await app.data.updateUser(kid);
            app.ui.closeModals();
            alert('Transaction successful!');
        }
    },

    ui: {
        showScreen(screenId) {
            Object.values(app.dom.screens).forEach(screen => {
                screen.classList.remove('active');
                screen.classList.add('hidden');
            });
            app.dom.screens[screenId].classList.remove('hidden');
            app.dom.screens[screenId].classList.add('active');

            if (screenId !== 'dashboard') {
                app.dom.dashboardContent.innerHTML = ''; // Clean up
            }
        },

        updateUserInfo(user) {
            document.getElementById('user-display-name').innerText = user.username;
            document.getElementById('user-role-badge').innerText = user.role ?
                (user.role === 'parent' ? 'Bank Manager 🏦' : 'Customer 💳') : 'New User';
        },

        renderTemplate(templateName) {
            const template = app.dom.templates[templateName];
            app.dom.dashboardContent.innerHTML = '';
            app.dom.dashboardContent.appendChild(template.content.cloneNode(true));
        },

        renderDashboard(user) {
            if (document.getElementById('dashboard-screen').classList.contains('hidden')) {
                this.showScreen('dashboard');
            }

            app.ui.updateUserInfo(user);

            if (!user.role) {
                this.renderTemplate('roleSelection');
                return;
            }

            if (user.role === 'parent') {
                // Only re-render if needed or clean slate, but for now simple innerHTML replacement or check
                // Simplified: Re-render template to ensure fresh state
                this.renderTemplate('parentDashboard');
                document.getElementById('parent-display-pin').innerText = user.bankPin || "Not Set";
                this.renderParentList();
            } else {
                this.renderTemplate('kidDashboard');
                // Ensure element exists before setting innerText
                const balEl = document.getElementById('kid-balance-amount');
                if (balEl) balEl.innerText = user.balance;
            }
        },

        renderParentList() {
            const listContainer = document.getElementById('parent-kids-list');
            if (!listContainer) return;

            const kids = app.data.getKidsForParent(app.state.currentUser.email);
            listContainer.innerHTML = '';

            if (kids.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #888;">
                        <p>No kids linked yet.</p>
                        <p style="font-size: 0.9rem;">Ask your kid to select "I am a Customer" and enter your Email & PIN.</p>
                    </div>`;
                return;
            }

            kids.forEach(kid => {
                const item = document.createElement('div');
                item.className = 'kid-item';
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 15px; background: white; border-radius: 12px; margin-bottom: 10px; border: 1px solid #eee;";
                item.innerHTML = `
                    <div>
                        <div class="kid-name" style="font-weight: bold; color: #333;">👤 ${kid.username}</div>
                        <div style="font-size: 0.8rem; color: #666;">Allowance: $${kid.allowance || 0}/week</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="kid-balance" style="font-size: 1.2rem; font-weight: bold; color: #28a745;">$${kid.balance}</div>
                        <button class="btn small" style="margin-top: 5px; background: #f0f0f0; color: #555;" onclick="app.handlers.showAllowanceModal('${kid.email}', ${kid.allowance || 0})">Edit Allowance</button>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        },

        openModal(modalId) {
            app.dom.modals.overlay.classList.remove('hidden');
            // Hide all modals first
            Object.values(app.dom.modals).forEach(el => {
                if (el !== app.dom.modals.overlay) el.classList.add('hidden');
            });
            // Show specific modal
            app.dom.modals[modalId].classList.remove('hidden');
        },

        closeModals() {
            app.dom.modals.overlay.classList.add('hidden');
            document.getElementById('link-parent-form')?.reset();
            document.getElementById('transaction-form')?.reset();
            document.getElementById('set-pin-form')?.reset();
            document.getElementById('allowance-form')?.reset();
        }
    }
};

// Initialize
app.init();
