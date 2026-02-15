/**
 * Bank of Piggo - Main Logic
 */

const app = {
    state: {
        users: JSON.parse(localStorage.getItem('bankOfPiggo_users')) || [],
        currentUser: null,
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.checkSession();
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

    checkSession() {
        // Simple session persistence check (optional, for now just show welcome)
        this.ui.showScreen('welcome');
    },

    data: {
        save() {
            localStorage.setItem('bankOfPiggo_users', JSON.stringify(app.state.users));
        },
        findUser(username) {
            return app.state.users.find(u => u.username === username);
        },
        updateUser(updatedUser) {
            const index = app.state.users.findIndex(u => u.username === updatedUser.username);
            if (index !== -1) {
                app.state.users[index] = updatedUser;
                this.save();
                // Update current user reference if it's the one logged in
                if (app.state.currentUser && app.state.currentUser.username === updatedUser.username) {
                    app.state.currentUser = updatedUser;
                }
            }
        },
        getKidsForParent(parentUsername) {
            return app.state.users.filter(u => u.role === 'kid' && u.linkedParent === parentUsername);
        }
    },

    handlers: {
        handleSignup(e) {
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

            app.state.users.push(newUser);
            app.data.save();
            this.login(newUser);
        },

        handleGoogleSignup() {
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

            app.state.users.push(newUser);
            app.data.save();
            this.login(newUser);
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
            app.ui.showScreen('welcome');
        },

        login(user) {
            app.state.currentUser = user;
            app.ui.updateUserInfo(user);

            if (!user.role) {
                app.ui.renderTemplate('roleSelection');
                app.ui.showScreen('dashboard');
            } else {
                app.ui.renderDashboard(user);
            }
        },

        selectRole(role) {
            if (role === 'parent') {
                app.state.currentUser.role = 'parent';
                app.data.updateUser(app.state.currentUser);
                app.ui.renderDashboard(app.state.currentUser);
            } else {
                // Kid needs to link to a parent
                app.ui.openModal('linkParent');
            }
        },

        handleLinkParent(e) {
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
                app.data.updateUser(app.state.currentUser);

                app.ui.closeModals();
                alert(`Successfully linked to ${parentUser.username}'s Bank!`);
                app.ui.renderDashboard(app.state.currentUser);
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

        handleTransaction(e) {
            e.preventDefault();
            const kidUsername = document.getElementById('transaction-kid-select').value;
            const amount = parseInt(document.getElementById('transaction-amount').value);

            if (!kidUsername || !amount) return;

            const kid = app.data.findUser(kidUsername);

            if (this.currentTransactionType === 'add') {
                kid.balance += amount;
            } else {
                if (kid.balance < amount) {
                    alert("Not enough Piggys in kid's account!");
                    return;
                }
                kid.balance -= amount;
            }

            app.data.updateUser(kid);
            app.ui.closeModals();
            app.ui.renderParentList(); // Refresh list to show new balance
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
            app.ui.updateUserInfo(user);
            app.ui.showScreen('dashboard');

            if (user.role === 'parent') {
                this.renderTemplate('parentDashboard');
                this.renderParentList();
            } else {
                this.renderTemplate('kidDashboard');
                document.getElementById('kid-balance-amount').innerText = user.balance;
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
            document.getElementById('parent-link-form')?.reset();
            document.getElementById('transaction-form')?.reset();
        }
    }
};

// Initialize
app.init();
