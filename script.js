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

const app = {
    state: {
        users: [],
        currentUser: JSON.parse(localStorage.getItem('bankOfPiggo_currentUser')) || null, // Keep session local
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.initRealtimeListener();

        // Restore session if exists
        if (this.state.currentUser) {
            // Re-fetch fresh data for current user from the list once loaded
            // (Handled by listener)
        } else {
            this.ui.showScreen('welcome');
        }
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
                transaction: document.getElementById('transaction-form')
            },
            modals: {
                overlay: document.getElementById('modal-overlay'),
                linkParent: document.getElementById('link-parent-modal'),
                transaction: document.getElementById('transaction-modal')
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
            if (app.state.currentUser) {
                const freshUser = app.state.users.find(u => u.username === app.state.currentUser.username);
                if (freshUser) {
                    app.state.currentUser = freshUser; // Update reference
                    app.ui.renderDashboard(freshUser); // Re-render
                }
            }
        });
    },

    data: {
        async createUser(user) {
            // Use username as doc ID to ensure uniqueness easily
            await db.collection('users').doc(user.username).set(user);
        },
        async updateUser(user) {
            await db.collection('users').doc(user.username).update(user);
        },
        findUser(username) {
            return app.state.users.find(u => u.username === username);
        },
        getKidsForParent(parentUsername) {
            return app.state.users.filter(u => u.role === 'kid' && u.linkedParent === parentUsername);
        }
    },

    handlers: {
        async handleSignup(e) {
            e.preventDefault();
            const username = document.getElementById('signup-username').value.trim();
            const password = document.getElementById('signup-password').value.trim();

            if (app.data.findUser(username)) {
                alert('Username already exists!');
                return;
            }

            const newUser = {
                username,
                password,
                role: null,
                balance: 0,
                linkedParent: null
            };

            try {
                await app.data.createUser(newUser);
                this.login(newUser);
            } catch (err) {
                console.error("Error creating user:", err);
                alert("Failed to create user. Check internet connection.");
            }
        },

        async handleGoogleSignup() {
            const randomSuffix = Math.floor(Math.random() * 1000);
            const username = `GoogleUser${randomSuffix}`;
            const password = Math.random().toString(36).slice(-8);

            // Show generated password notification
            const notif = document.createElement('div');
            notif.style.cssText = `
                position: fixed; top: 10px; left: 10px; 
                background: white; padding: 10px; border: 2px solid #333; 
                border-radius: 8px; z-index: 2000; box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            `;
            notif.innerHTML = `<strong>Created!</strong><br>User: ${username}<br>Pass: ${password}`;
            document.body.appendChild(notif);
            setTimeout(() => notif.remove(), 8000);

            const newUser = {
                username,
                password,
                isGoogle: true,
                role: null,
                balance: 0,
                linkedParent: null
            };

            try {
                await app.data.createUser(newUser);
                this.login(newUser);
            } catch (err) {
                console.error("Error creating user:", err);
                alert("Failed to create user.");
            }
        },

        handleLogin(e) {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();

            const user = app.state.users.find(u => u.username === username && u.password === password);

            if (user) {
                this.login(user);
            } else {
                alert('Invalid credentials!');
            }
        },

        handleLogout() {
            app.state.currentUser = null;
            localStorage.removeItem('bankOfPiggo_currentUser');
            app.ui.showScreen('welcome');
        },

        login(user) {
            app.state.currentUser = user;
            localStorage.setItem('bankOfPiggo_currentUser', JSON.stringify(user));

            if (!user.role) {
                app.ui.renderTemplate('roleSelection');
                app.ui.showScreen('dashboard');
            } else {
                app.ui.renderDashboard(user);
            }
        },

        async selectRole(role) {
            if (role === 'parent') {
                app.state.currentUser.role = 'parent';
                await app.data.updateUser(app.state.currentUser);
            } else {
                // Kid needs to link to a parent
                app.ui.openModal('linkParent');
            }
        },

        async handleLinkParent(e) {
            e.preventDefault();
            const parentUsername = document.getElementById('parent-link-username').value.trim();
            const parentPassword = document.getElementById('parent-link-password').value.trim();

            // Verify parent credentials
            const parentUser = app.state.users.find(u =>
                u.username === parentUsername &&
                u.password === parentPassword &&
                u.role === 'parent' // Must be a registered parent
            );

            if (parentUser) {
                app.state.currentUser.role = 'kid';
                app.state.currentUser.linkedParent = parentUser.username;
                await app.data.updateUser(app.state.currentUser);

                app.ui.closeModals();
                alert(`Successfully linked to ${parentUser.username}'s Bank!`);
            } else {
                alert('Invalid parent credentials or parent account not found/created yet.');
            }
        },

        // Transaction Logic
        currentTransactionType: null, // 'add' or 'remove'

        showTransactionModal(type) {
            this.currentTransactionType = type;
            const title = type === 'add' ? 'Put Money in Kid' : 'Deposit (Remove) Money';
            document.getElementById('transaction-title').innerText = title;

            // Populate kids dropdown
            const select = document.getElementById('transaction-kid-select');
            select.innerHTML = '<option value="" disabled selected>Select Kid</option>';

            const kids = app.data.getKidsForParent(app.state.currentUser.username);

            if (kids.length === 0) {
                alert("No kids linked yet! Ask your kid to create a profile and link to you.");
                return;
            }

            kids.forEach(kid => {
                const opt = document.createElement('option');
                opt.value = kid.username;
                opt.innerText = `${kid.username} (Bal: ${kid.balance})`;
                select.appendChild(opt);
            });

            app.ui.openModal('transaction');
        },

        async handleTransaction(e) {
            e.preventDefault();
            const kidUsername = document.getElementById('transaction-kid-select').value;
            const amount = parseInt(document.getElementById('transaction-amount').value);

            if (!kidUsername || !amount) return;

            const kid = app.data.findUser(kidUsername);
            if (!kid) return;

            if (this.currentTransactionType === 'add') {
                kid.balance += amount;
            } else {
                if (kid.balance < amount) {
                    alert("Not enough Piggys in kid's account!");
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
                (user.role === 'parent' ? 'Bank Owner 🏦' : 'Saver 🐷') : 'New User';
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

            if (user.role === 'parent') {
                // Only re-render if needed or clean slate, but for now simple innerHTML replacement or check
                // Simplified: Re-render template to ensure fresh state
                this.renderTemplate('parentDashboard');
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

            const kids = app.data.getKidsForParent(app.state.currentUser.username);
            listContainer.innerHTML = '';

            if (kids.length === 0) {
                listContainer.innerHTML = '<p style="color: #999; text-align: center;">No kids linked yet.<br>Tell them to select "Use Parents Bank"!</p>';
                return;
            }

            kids.forEach(kid => {
                const item = document.createElement('div');
                item.className = 'kid-item';
                item.innerHTML = `
                    <span class="kid-name">🐷 ${kid.username}</span>
                    <span class="kid-balance">${kid.balance} Piggys</span>
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
        }
    }
};

// Initialize
app.init();
