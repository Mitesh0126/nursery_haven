// User management
let isAuthenticated = false;
let currentUser = null;
let cart = [];
let currentCategory = 'all';

// API base URL
const API_BASE_URL = window.location.origin;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadPlants();
    updateCartCount();
    initAuth();
    initEventListeners();
    initMobileNavigation();

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId && targetId !== '#' && targetId.length > 1) {
                const target = document.querySelector(targetId);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Cart modal event listener
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.addEventListener('show.bs.modal', updateCartDisplay);
        cartModal.addEventListener('shown.bs.modal', function() {
            const freeShippingOffer = document.getElementById('freeShippingOffer');
            const bulkDiscountOffer = document.getElementById('bulkDiscountOffer');

            if (freeShippingOffer) {
                freeShippingOffer.addEventListener('change', updateCartSummary);
            }
            if (bulkDiscountOffer) {
                bulkDiscountOffer.addEventListener('change', updateCartSummary);
            }
        });
    }

    // Payment form formatting
    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
        cardNumber.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '');
            value = value.replace(/\D/g, '');
            value = value.replace(/(\d{4})/g, '$1 ').trim();
            e.target.value = value.substring(0, 19);
        });
    }

    const expiryDate = document.getElementById('expiryDate');
    if (expiryDate) {
        expiryDate.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
    }

    const cvv = document.getElementById('cvv');
    if (cvv) {
        cvv.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
        });
    }

    // Payment method selection
    const paymentMethodInputs = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethodInputs.forEach(method => {
        method.addEventListener('change', function() {
            const creditCardForm = document.getElementById('creditCardForm');
            const upiForm = document.getElementById('upiForm');
            const codForm = document.getElementById('codForm');

            // Hide all forms
            if (creditCardForm) creditCardForm.style.display = 'none';
            if (upiForm) upiForm.style.display = 'none';
            if (codForm) codForm.style.display = 'none';

            // Show selected form
            if (this.value === 'credit_card' && creditCardForm) {
                creditCardForm.style.display = 'block';
            } else if (this.value === 'upi' && upiForm) {
                upiForm.style.display = 'block';
            } else if (this.value === 'cod' && codForm) {
                codForm.style.display = 'block';
            }

            updatePaymentOrderSummary();
        });
    });

    // Homepage specific initialization
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '/index.html') {
        loadProductCatalog();
    }
});

// API Helper functions
async function apiCall(endpoint, options = {}) {
    const token = sessionStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Initialize event listeners
function initEventListeners() {
    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterProducts);
    }

    // Search functionality
    const productSearch = document.getElementById('productSearch');
    if (productSearch) {
        productSearch.addEventListener('input', debounce(searchProducts, 300));
        productSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchProducts();
            }
        });
    }
}

// Authentication functions
function initAuth() {
    const token = sessionStorage.getItem('authToken');
    const userData = sessionStorage.getItem('currentUser');

    if (token && userData) {
        currentUser = JSON.parse(userData);
        isAuthenticated = true;
        updateAuthUI();
    }
}

function updateAuthUI() {
    const authContainer = document.getElementById('auth-container');
    const userInfo = document.getElementById('user-info');
    const username = document.getElementById('username');
    const authToggleBtn = document.getElementById('authToggleBtn');

    if (isAuthenticated && currentUser) {
        if (authContainer) authContainer.classList.remove('d-none');
        if (userInfo) userInfo.classList.remove('d-none');
        if (username) username.textContent = currentUser.name;
        if (authToggleBtn) {
            authToggleBtn.innerHTML = '<i class="fas fa-user me-1"></i>Logout';
            authToggleBtn.className = 'btn btn-outline-danger me-2';
        }
    } else {
        if (authContainer) authContainer.classList.remove('d-none');
        if (userInfo) userInfo.classList.add('d-none');
        if (authToggleBtn) {
            authToggleBtn.innerHTML = '<i class="fas fa-user me-1"></i>Login';
            authToggleBtn.className = 'btn btn-success me-2';
        }
    }

    updateMobileAuthUI();
}

function toggleAuth() {
    if (isAuthenticated && currentUser) {
        logout();
    } else {
        window.location.href = './login.html';
    }
}

async function loadPlants(category = 'all') {
    try {
        const data = await apiCall(`/api/products?category=${category}`);
        return data.products || [];
    } catch (error) {
        console.error('Error loading plants:', error);
        return [];
    }
}

function filterPlants(category) {
    currentCategory = category;
    loadPlants(category);
}

// Shopping cart functions
function addToCart(plantId) {
    const existingItem = cart.find(item => item.id === plantId);
    const plant = currentProducts.find(p => p._id === plantId);

    if (!plant) {
        showErrorMessage('Plant not found!');
        return;
    }

    // Check stock availability
    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    const requestedQuantity = currentCartQuantity + 1;

    if (requestedQuantity > plant.stock) {
        showErrorMessage(`Sorry! Only ${plant.stock} items available in stock.`);
        return;
    }

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: plant._id,
            name: plant.name,
            price: plant.price,
            image: plant.image,
            quantity: 1,
            availableStock: plant.stock
        });
    }

    updateCartCount();
    showSuccessMessage(`${plant.name} added to cart!`);
}

function removeFromCart(plantId) {
    cart = cart.filter(item => item.id !== plantId);
    updateCartCount();
    updateCartDisplay();
}

function updateQuantity(plantId, newQuantity) {
    const item = cart.find(item => item.id === plantId);
    const plant = currentProducts.find(p => p._id === plantId);

    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(plantId);
        } else {
            // Check stock availability
            if (plant && newQuantity > plant.stock) {
                showErrorMessage(`Sorry! Only ${plant.stock} items available in stock.`);
                return;
            }

            item.quantity = newQuantity;
            updateCartCount();
            updateCartDisplay();
        }
    }
}

function updateCartCount() {
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

    const desktopCartCount = document.getElementById('cart-count');
    if (desktopCartCount) {
        desktopCartCount.textContent = cartCount;
    }

    const mobileCartCount = document.getElementById('mobile-cart-count');
    if (mobileCartCount) {
        mobileCartCount.textContent = cartCount;
    }
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');
    if (!cartItems) return;

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">Your cart is empty</h5>
                <p class="text-muted">Add some beautiful plants to get started!</p>
            </div>
        `;
        if (cartSummary) cartSummary.style.display = 'none';
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="d-flex align-items-center mb-3 p-3 border rounded">
            <img src="${item.image || 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100&h=100&fit=crop'}"
                 alt="${item.name}" class="rounded me-3" style="width: 60px; height: 60px; object-fit: cover;">
            <div class="flex-grow-1">
                <h6 class="mb-1">${item.name}</h6>
                <p class="text-muted mb-0">₹${item.price} × ${item.quantity}</p>
            </div>
            <div class="d-flex align-items-center">
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                <span class="mx-2">${item.quantity}</span>
                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                <button class="btn btn-sm btn-outline-danger ms-3" onclick="removeFromCart('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    if (cartSummary) {
        cartSummary.style.display = 'block';
        updateCartSummary();
    }
}

function updateCartSummary() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    let shipping = 0;
    const freeShippingOffer = document.getElementById('freeShippingOffer');
    if (freeShippingOffer && freeShippingOffer.checked && subtotal >= 500) {
        shipping = 0;
    } else {
        shipping = subtotal > 0 ? 50 : 0;
    }

    let bulkDiscount = 0;
    const bulkDiscountOffer = document.getElementById('bulkDiscountOffer');
    if (bulkDiscountOffer && bulkDiscountOffer.checked && totalItems >= 5) {
        bulkDiscount = subtotal * 0.10;
    }

    const taxableAmount = subtotal - bulkDiscount;
    const tax = taxableAmount * 0.18;
    const total = taxableAmount + tax + shipping;

    document.getElementById('cart-subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('cart-shipping').textContent = shipping.toFixed(2);
    document.getElementById('cart-tax').textContent = tax.toFixed(2);
    document.getElementById('cart-total').textContent = total.toFixed(2);
}

function updatePaymentOrderSummary() {
    const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (!selectedPaymentMethod) return;

    const paymentOrderSummary = document.getElementById('paymentOrderSummary');
    if (!paymentOrderSummary) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    let shipping = 0;
    const freeShippingOffer = document.getElementById('freeShippingOffer');
    if (freeShippingOffer && freeShippingOffer.checked && subtotal >= 500) {
        shipping = 0;
    } else {
        shipping = subtotal > 0 ? 50 : 0;
    }

    let bulkDiscount = 0;
    const bulkDiscountOffer = document.getElementById('bulkDiscountOffer');
    if (bulkDiscountOffer && bulkDiscountOffer.checked && totalItems >= 5) {
        bulkDiscount = subtotal * 0.10;
    }

    const taxableAmount = subtotal - bulkDiscount;
    const tax = taxableAmount * 0.18;
    const codCharge = selectedPaymentMethod.value === 'cod' ? 50 : 0;
    const total = taxableAmount + tax + shipping + codCharge;

    paymentOrderSummary.innerHTML = `
        <div class="mb-3">
            <h6>Order Items:</h6>
            ${cart.map(item => `
                <div class="d-flex justify-content-between mb-1">
                    <span>${item.name} (x${item.quantity})</span>
                    <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join('')}
        </div>
        <hr>
        <div class="d-flex justify-content-between mb-1">
            <span>Subtotal:</span>
            <span>₹${subtotal.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
            <span>Shipping:</span>
            <span>₹${shipping.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
            <span>Tax (18% GST):</span>
            <span>₹${tax.toFixed(2)}</span>
        </div>
        ${bulkDiscount > 0 ? `
        <div class="d-flex justify-content-between mb-1 text-success">
            <span>Bulk Discount:</span>
            <span>-₹${bulkDiscount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${codCharge > 0 ? `
        <div class="d-flex justify-content-between mb-1 text-warning">
            <span>COD Charge:</span>
            <span>₹${codCharge.toFixed(2)}</span>
        </div>
        ` : ''}
        <hr>
        <div class="d-flex justify-content-between fw-bold">
            <span>Total:</span>
            <span>₹${total.toFixed(2)}</span>
        </div>
    `;
}

function clearCart() {
    if (confirm('Are you sure you want to clear your cart?')) {
        cart = [];
        updateCartCount();
        updateCartDisplay();
        showMessage('Cart cleared successfully!', 'success');
    }
}

// Payment Gateway Functions
let currentOrder = null;

function showPaymentModal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    let shipping = 0;
    const freeShippingOffer = document.getElementById('freeShippingOffer');
    if (freeShippingOffer && freeShippingOffer.checked && subtotal >= 500) {
        shipping = 0;
    } else {
        shipping = subtotal > 0 ? 50 : 0;
    }

    let bulkDiscount = 0;
    const bulkDiscountOffer = document.getElementById('bulkDiscountOffer');
    if (bulkDiscountOffer && bulkDiscountOffer.checked && totalItems >= 5) {
        bulkDiscount = subtotal * 0.10;
    }

    const taxableAmount = subtotal - bulkDiscount;
    const tax = taxableAmount * 0.18;
    const total = taxableAmount + tax + shipping;

    currentOrder = {
        customerId: currentUser.id,
        customerName: currentUser.name,
        customerEmail: currentUser.email,
        items: [...cart],
        subtotal: subtotal,
        shipping: shipping,
        tax: tax,
        total: total
    };

    updatePaymentOrderSummary();
    initializeBasketReadyScheduling();

    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    paymentModal.show();

    document.getElementById('paymentForm').style.display = 'block';
    document.getElementById('paymentProcessing').style.display = 'none';
    document.getElementById('paymentSuccess').style.display = 'none';
    document.getElementById('paymentModalFooter').style.display = 'block';
    document.getElementById('cardPaymentForm').reset();
}

function initializeBasketReadyScheduling() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('preferredDate');
    if (dateInput) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
        dateInput.min = tomorrow.toISOString().split('T')[0];
    }

    const deliveryRadio = document.getElementById('delivery');
    const pickupRadio = document.getElementById('pickup');

    if (deliveryRadio && pickupRadio) {
        deliveryRadio.addEventListener('change', updateFulfillmentUI);
        pickupRadio.addEventListener('change', updateFulfillmentUI);
        updateFulfillmentUI();
    }
}

function updateFulfillmentUI() {
    const deliveryRadio = document.getElementById('delivery');
    const pickupRadio = document.getElementById('pickup');
    const specialInstructions = document.getElementById('specialInstructions');

    if (deliveryRadio && pickupRadio && specialInstructions) {
        if (deliveryRadio.checked) {
            specialInstructions.placeholder = "Any special delivery instructions (e.g., gate code, floor number, contact person)...";
        } else if (pickupRadio.checked) {
            specialInstructions.placeholder = "Any special pickup instructions (e.g., vehicle details, contact person)...";
        }
    }
}

async function processPayment() {
    const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (!selectedPaymentMethod) {
        showMessage('Please select a payment method', 'error');
        return;
    }

    // Validate Basket Ready scheduling fields
    const fulfillmentType = document.querySelector('input[name="fulfillmentType"]:checked');
    const preferredDate = document.getElementById('preferredDate').value;
    const preferredTime = document.getElementById('preferredTime').value;
    let isValid = true;
    let errorMessage = '';

    if (!fulfillmentType) {
        errorMessage = 'Please select a fulfillment type (Delivery or Pickup).';
        isValid = false;
    } else if (!preferredDate) {
        errorMessage = 'Please select a preferred date for your order.';
        isValid = false;
    } else if (!preferredTime) {
        errorMessage = 'Please select a preferred time slot for your order.';
        isValid = false;
    }

    if (selectedPaymentMethod.value === 'credit_card') {
        const cardNumber = document.getElementById('cardNumber').value;
        const expiryDate = document.getElementById('expiryDate').value;
        const cvv = document.getElementById('cvv').value;
        const cardHolderName = document.getElementById('cardHolderName').value;

        if (!cardNumber || !expiryDate || !cvv || !cardHolderName) {
            errorMessage = 'Please fill in all card details.';
            isValid = false;
        } else if (cardNumber.replace(/\s/g, '').length !== 16) {
            errorMessage = 'Please enter a valid 16-digit card number.';
            isValid = false;
        } else if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
            errorMessage = 'Please enter expiry date in MM/YY format.';
            isValid = false;
        } else if (cvv.length !== 3) {
            errorMessage = 'Please enter a valid 3-digit CVV.';
            isValid = false;
        }
    } else if (selectedPaymentMethod.value === 'upi') {
        const upiId = document.getElementById('upiId').value;
        const upiApp = document.getElementById('upiApp').value;

        if (!upiId || !upiApp) {
            errorMessage = 'Please fill in all UPI details.';
            isValid = false;
        } else if (!upiId.includes('@')) {
            errorMessage = 'Please enter a valid UPI ID (e.g., yourname@upi).';
            isValid = false;
        }
    } else if (selectedPaymentMethod.value === 'cod') {
        const codPhone = document.getElementById('codPhone').value;
        const codAddress = document.getElementById('codAddress').value;

        if (!codPhone || !codAddress) {
            errorMessage = 'Please fill in all delivery details.';
            isValid = false;
        } else if (codPhone.length !== 10) {
            errorMessage = 'Please enter a valid 10-digit phone number.';
            isValid = false;
        }
    }

    if (!isValid) {
        showErrorMessage(errorMessage);
        return;
    }

    // Show processing state
    document.getElementById('paymentForm').style.display = 'none';
    document.getElementById('paymentProcessing').style.display = 'block';
    document.getElementById('paymentModalFooter').style.display = 'none';

    // Simulate payment processing
    setTimeout(async () => {
        try {
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            const authToken = sessionStorage.getItem('authToken');

            if (!authToken || !currentUser.id) {
                throw new Error('Please login first');
            }

            // Get delivery details - use stored customer details from modal
            const deliveryDetails = window.customerDetails || getDeliveryDetails();
            const basketReady = getBasketReadyDetails();

            // Calculate order totals
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

            let shipping = 0;
            const freeShippingOffer = document.getElementById('freeShippingOffer');
            if (freeShippingOffer && freeShippingOffer.checked && subtotal >= 500) {
                shipping = 0;
            } else {
                shipping = subtotal > 0 ? 50 : 0;
            }

            let bulkDiscount = 0;
            const bulkDiscountOffer = document.getElementById('bulkDiscountOffer');
            if (bulkDiscountOffer && bulkDiscountOffer.checked && totalItems >= 5) {
                bulkDiscount = subtotal * 0.10;
            }

            const taxableAmount = subtotal - bulkDiscount;
            const tax = taxableAmount * 0.18;
            const codCharge = selectedPaymentMethod.value === 'cod' ? 50 : 0;
            const total = taxableAmount + tax + shipping + codCharge;

            // Prepare order data with completed payment status
            const orderData = {
                customerName: currentUser.name,
                customerEmail: currentUser.email,
                items: cart.map(item => ({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image
                })),
                subtotal: taxableAmount,
                tax: tax,
                shipping: shipping,
                total: total,
                paymentMethod: selectedPaymentMethod.value.toUpperCase(),
                paymentStatus: 'completed', // Mark payment as completed
                orderStatus: 'processing',
                deliveryDetails: deliveryDetails,
                basketReady: basketReady,
                codCharge: codCharge
            };

            // Submit order
            const result = await apiCall('/api/orders', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(orderData)
            });

            // Show success
            document.getElementById('paymentProcessing').style.display = 'none';
            document.getElementById('paymentSuccess').style.display = 'block';
            document.getElementById('successOrderId').textContent = result.order.orderId;
            document.getElementById('successTransactionId').textContent = result.order.transactionId;

            // Clear cart
            cart = [];
            updateCartCount();
            updateCartDisplay();

            // Refresh product catalog to show updated stock
            if (typeof loadProductCatalog === 'function') {
                loadProductCatalog();
            }

            showMessage('Order placed successfully!', 'success');

        } catch (error) {
            console.error('Payment processing failed:', error);
            showMessage('Payment failed: ' + error.message, 'error');

            // Reset form on error
            document.getElementById('paymentProcessing').style.display = 'none';
            document.getElementById('paymentForm').style.display = 'block';
            document.getElementById('paymentModalFooter').style.display = 'block';
        }
    }, 3000); // 3 second delay for payment simulation
}


function getDeliveryDetails() {
    const customerName = document.getElementById('customerName')?.value;
    const customerPhone = document.getElementById('customerPhone')?.value;
    const customerAddress = document.getElementById('customerAddress')?.value;
    const customerCity = document.getElementById('customerCity')?.value;
    const customerState = document.getElementById('customerState')?.value;
    const customerPin = document.getElementById('customerPin')?.value;
    const deliveryNotes = document.getElementById('deliveryNotes')?.value;

    return {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        city: customerCity,
        state: customerState || '',
        pin: customerPin,
        notes: deliveryNotes
    };
}

function getBasketReadyDetails() {
    const fulfillmentType = document.querySelector('input[name="fulfillmentType"]:checked')?.value;
    const preferredDate = document.getElementById('preferredDate')?.value;
    const preferredTime = document.getElementById('preferredTime')?.value;
    const specialInstructions = document.getElementById('specialInstructions')?.value;

    return {
        fulfillmentType: fulfillmentType,
        preferredDate: preferredDate,
        preferredTime: preferredTime,
        specialInstructions: specialInstructions
    };
}


async function viewOrderTracking() {
    if (!isAuthenticated) {
        showErrorMessage('Please log in to view order tracking.');
        return;
    }

    try {
        const orders = await apiCall('/api/orders');

        if (orders.length === 0) {
            document.getElementById('orderTrackingContent').innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-truck fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No orders found</h5>
                    <p class="text-muted">You haven't placed any orders yet.</p>
                </div>
            `;
        } else {
            document.getElementById('orderTrackingContent').innerHTML = `
                <div class="row">
                    ${orders.map(order => `
                        <div class="col-12 mb-4">
                            <div class="card">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">Order #${order.orderId}</h6>
                                    <span class="badge bg-${order.paymentStatus === 'completed' ? 'success' : 'warning'}">
                                        ${order.paymentStatus}
                                    </span>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-8">
                                            <h6>Order Details</h6>
                                            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                                            <p><strong>Total Amount:</strong> ₹${order.total?.toFixed(2)}</p>
                                            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                                            <p><strong>Items:</strong></p>
                                            <ul class="mb-2">
                                                ${order.items.map(item => `<li>${item.name} (x${item.quantity})</li>`).join('')}
                                            </ul>
                                            ${order.deliveryDate ? `
                                                <hr>
                                                <h6 class="text-success"><i class="fas fa-calendar-alt me-2"></i>Schedule</h6>
                                                <p><strong>Delivery Date:</strong> ${new Date(order.deliveryDate).toLocaleDateString()}</p>
                                                <p><strong>Time Slot:</strong> ${order.deliveryTime}</p>
                                                ${order.specialInstructions ? `<p><strong>Special Instructions:</strong> ${order.specialInstructions}</p>` : ''}
                                            ` : ''}
                                        </div>
                                        <div class="col-md-4">
                                            <h6>Delivery Status</h6>
                                            <div class="delivery-timeline">
                                                ${getDeliveryTimeline(order)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const trackingModal = new bootstrap.Modal(document.getElementById('orderTrackingModal'));
        trackingModal.show();

    } catch (error) {
        showErrorMessage('Failed to load orders: ' + error.message);
    }
}

function getDeliveryTimeline(order) {
    const statuses = ['pending', 'processing', 'shipped', 'delivered'];
    const currentStatus = order.orderStatus || 'pending';
    const currentIndex = statuses.indexOf(currentStatus);

    return statuses.map((status, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return `
            <div class="delivery-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                <div class="step-icon">
                    <i class="fas fa-${getStatusIcon(status)}"></i>
                </div>
                <div class="step-content">
                    <div class="step-title">${getStatusTitle(status)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusIcon(status) {
    switch (status) {
        case 'pending': return 'clock';
        case 'processing': return 'cog';
        case 'shipped': return 'truck';
        case 'delivered': return 'check-circle';
        default: return 'clock';
    }
}

function getStatusTitle(status) {
    switch (status) {
        case 'pending': return 'Order Placed';
        case 'processing': return 'Processing';
        case 'shipped': return 'Shipped';
        case 'delivered': return 'Delivered';
        default: return 'Order Placed';
    }
}

function checkout() {
    if (cart.length === 0) {
        showErrorMessage('Your cart is empty!');
        return;
    }

    if (!isAuthenticated) {
        showErrorMessage('Please log in to proceed with checkout.');
        return;
    }

    showCustomerDetailsModal();
}

function showCustomerDetailsModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="modal fade" id="customerDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-user me-2"></i>Customer Details
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-8">
                                <form id="customerDetailsForm">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="customerName" class="form-label">Full Name *</label>
                                                <input type="text" class="form-control" id="customerName" required placeholder="Enter your full name">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="customerPhone" class="form-label">Phone Number *</label>
                                                <input type="tel" class="form-control" id="customerPhone" required pattern="[0-9]{10}" placeholder="Enter 10-digit phone number">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="customerAddress" class="form-label">Complete Address *</label>
                                        <textarea class="form-control" id="customerAddress" rows="3" required placeholder="Enter your complete address (House/Flat No., Street, Area)"></textarea>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="customerCity" class="form-label">City *</label>
                                                <input type="text" class="form-control" id="customerCity" required placeholder="Enter your city">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="customerPin" class="form-label">PIN Code *</label>
                                                <input type="text" class="form-control" id="customerPin" required placeholder="6-digit PIN code">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="deliveryNotes" class="form-label">Special Instructions (Optional)</label>
                                        <textarea class="form-control" id="deliveryNotes" rows="2" placeholder="Any special delivery instructions or notes"></textarea>
                                    </div>
                                </form>
                            </div>
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-header">
                                        <h6 class="mb-0"><i class="fas fa-shopping-cart me-2"></i>Order Summary</h6>
                                    </div>
                                    <div class="card-body">
                                        <div class="mb-2">
                                            <small class="text-muted">Items in cart:</small>
                                        </div>
                                        ${cart.map(item => `
                                            <div class="d-flex justify-content-between mb-1">
                                                <small>${item.name} (x${item.quantity})</small>
                                                <small>₹${(item.price * item.quantity).toFixed(2)}</small>
                                            </div>
                                        `).join('')}
                                        <hr>
                                        <div class="d-flex justify-content-between fw-bold">
                                            <span>Total:</span>
                                            <span>₹${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-arrow-left me-2"></i>Back to Cart
                        </button>
                        <button type="button" class="btn btn-success" onclick="proceedToPayment()">
                            <i class="fas fa-credit-card me-2"></i>Proceed to Payment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const customerModal = new bootstrap.Modal(document.getElementById('customerDetailsModal'));
    customerModal.show();

    if (isAuthenticated && currentUser) {
        const customerNameField = document.getElementById('customerName');
        if (customerNameField) {
            customerNameField.value = currentUser.name;
        }
    }

    document.getElementById('customerDetailsModal').addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modal);
    });
}

function proceedToPayment() {
    const form = document.getElementById('customerDetailsForm');
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    const city = document.getElementById('customerCity').value.trim();
    const pin = document.getElementById('customerPin').value.trim();

    if (!name || name.length < 2) {
        showErrorMessage('Please enter a valid name (at least 2 characters).');
        return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phone || !phoneRegex.test(phone)) {
        showErrorMessage('Please enter a valid 10-digit phone number.');
        return;
    }

    if (!address || address.length < 10) {
        showErrorMessage('Please enter a complete address (at least 10 characters).');
        return;
    }

    const cityRegex = /^[A-Za-z ]{2,}$/;
    if (!city || !cityRegex.test(city)) {
        showErrorMessage('Please enter a valid city name (letters and spaces only).');
        return;
    }

    const pinRegex = /^\d{6}$/;
    if (!pin || !pinRegex.test(pin)) {
        showErrorMessage('Please enter a valid 6-digit PIN code.');
        return;
    }

    const state = document.getElementById('customerState')?.value.trim() || '';

    window.customerDetails = {
        name: name,
        phone: phone,
        address: address,
        city: city,
        state: state,
        pin: pin,
        notes: document.getElementById('deliveryNotes').value.trim()
    };

    const customerModal = bootstrap.Modal.getInstance(document.getElementById('customerDetailsModal'));
    customerModal.hide();

    setTimeout(() => {
        showPaymentModal();
    }, 300);
}

async function submitConsultation() {
    const form = document.getElementById('consultForm');
    const formData = new FormData(form);

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    try {
        const consultationData = {
            name: formData.get('consultName') || document.getElementById('consultName').value,
            email: formData.get('consultEmail') || document.getElementById('consultEmail').value,
            message: formData.get('consultMessage') || document.getElementById('consultMessage').value
        };

        await apiCall('/api/consultations', {
            method: 'POST',
            body: JSON.stringify(consultationData)
        });

        showSuccessMessage('Thank you! We will contact you within 24 hours for your free consultation.');
        const consultModal = bootstrap.Modal.getInstance(document.getElementById('consultModal'));
        if (consultModal) {
            consultModal.hide();
        }
        form.reset();

    } catch (error) {
        showErrorMessage('Failed to submit consultation request: ' + error.message);
    }
}

function logout() {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('currentUser');
    cart = [];
    isAuthenticated = false;
    currentUser = null;
    updateAuthUI();
    showSuccessMessage('Successfully logged out!');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

window.logout = logout;
window.toggleAuth = toggleAuth;
window.initializeBasketReadyScheduling = initializeBasketReadyScheduling;
window.updateFulfillmentUI = updateFulfillmentUI;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.checkout = checkout;
window.submitConsultation = submitConsultation;
window.filterProducts = filterProducts;
window.performSearch = performSearch;
window.performMobileSearch = performMobileSearch;
window.changeQuantity = changeQuantity;
window.addToCartFromModal = addToCartFromModal;

function showMessage(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alert.style.cssText = 'top: 100px; right: 20px; z-index: 9999; max-width: 350px;';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function showSuccessMessage(message) {
    showMessage(message, 'success');
}

function showErrorMessage(message) {
    showMessage(message, 'danger');
}

// Product Catalog Functions
let currentProducts = [];
let filteredProducts = [];
let currentPage = 1;
const productsPerPage = 12;

async function loadProductCatalog() {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    try {
        const data = await apiCall('/api/products');
        currentProducts = data.products || [];
        filteredProducts = [...currentProducts];
        displayProducts();
    } catch (error) {
        console.error('Error loading products:', error);
        productsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <h4 class="text-muted">Error loading products</h4>
                <p class="text-muted">Please try again later.</p>
            </div>
        `;
    }
}

function displayProducts() {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);

    if (currentPage === 1) {
        productsGrid.innerHTML = '';
    }

    if (productsToShow.length === 0 && currentPage === 1) {
        productsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-seedling fa-3x text-muted mb-3"></i>
                <h4 class="text-muted">No plants found</h4>
                <p class="text-muted">Try adjusting your search criteria or filters.</p>
            </div>
        `;
        return;
    }

    productsToShow.forEach(product => {
        const col = document.createElement('div');
        col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
        col.innerHTML = `
            <div class="card h-100 product-card shadow-sm border-0 rounded-3" style="transition: transform 0.3s ease, box-shadow 0.3s ease;">
                <div class="position-relative">
                    <img src="${product.image || 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=200&fit=crop'}"
                         class="card-img-top" alt="${product.name}" style="height: 200px; object-fit: cover;">
                    <div class="position-absolute top-0 end-0 m-2">
                        <span class="badge bg-success">${product.category}</span>
                    </div>
                    ${product.stock < 5 ? '<div class="position-absolute top-0 start-0 m-2"><span class="badge bg-warning">Low Stock</span></div>' : ''}
                </div>
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title fw-bold mb-2">${product.name}</h5>
                    <div class="product-meta mb-3">
                        <span class="badge bg-light text-dark me-2">
                            <i class="fas fa-tag me-1"></i>${product.category}
                        </span>
                        <span class="badge bg-${product.stock > 0 ? 'success' : 'danger'}">
                            <i class="fas fa-box me-1"></i>
                            ${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                    </div>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="h5 text-success mb-0">₹${product.price}</span>
                            <span class="text-muted small">Stock: ${product.stock}</span>
                        </div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-outline-success btn-sm" onclick="viewProductDetails('${product._id}')">
                                <i class="fas fa-eye me-1"></i>View Details
                            </button>
                            <button class="btn btn-success btn-sm" onclick="addToCart('${product._id}')" ${product.stock === 0 ? 'disabled' : ''}>
                                <i class="fas fa-cart-plus me-1"></i>${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        productsGrid.appendChild(col);
    });

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = endIndex < filteredProducts.length ? 'inline-block' : 'none';
    }
}

function loadMoreProducts() {
    currentPage++;
    displayProducts();
}

function viewProductDetails(productId) {
    const product = currentProducts.find(p => p._id === productId);

    if (!product) {
        showErrorMessage('Product not found!');
        return;
    }

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="modal fade" id="productDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title text-success">${product.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <img src="${product.image}" class="img-fluid rounded" alt="${product.name}">
                            </div>
                            <div class="col-md-6">
                                <h4 class="text-success mb-3">₹${product.price}</h4>
                                <div class="mb-3">
                                    <span class="badge bg-light text-dark me-2">
                                        <i class="fas fa-tag me-1"></i>${product.category}
                                    </span>
                                    <span class="badge bg-${product.stock > 0 ? 'success' : 'danger'}">
                                        <i class="fas fa-box me-1"></i>
                                        ${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                                    </span>
                                </div>
                                <div class="quantity-selector mb-3">
                                    <label class="form-label">Quantity:</label>
                                    <div class="input-group" style="width: 150px;">
                                        <button class="btn btn-outline-secondary" type="button" onclick="changeQuantity(-1)">-</button>
                                        <input type="number" class="form-control text-center" id="productQuantity" value="1" min="1" max="${product.stock}">
                                        <button class="btn btn-outline-secondary" type="button" onclick="changeQuantity(1)">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-12">
                                <h6 class="text-success mb-3"><i class="fas fa-info-circle me-2"></i>Product Description</h6>
                                <div class="border p-3 rounded bg-light">
                                    <p class="text-muted mb-0">${product.description}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-success" onclick="addToCartFromModal('${product._id}')" ${product.stock <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus me-1"></i>Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const productModal = new bootstrap.Modal(document.getElementById('productDetailsModal'));
    productModal.show();

    document.getElementById('productDetailsModal').addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modal);
    });
}

async function filterProducts() {
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    currentPage = 1;

    try {
        const data = await apiCall(`/api/products?category=${categoryFilter}`);
        filteredProducts = data.products || [];
        displayProducts();
    } catch (error) {
        console.error('Error filtering products:', error);
    }
}

async function searchProducts() {
    const searchInput = document.getElementById('productSearch');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    currentPage = 1;

    try {
        const data = await apiCall(`/api/products?search=${encodeURIComponent(query)}`);
        filteredProducts = data.products || [];
        displayProducts();
    } catch (error) {
        console.error('Error searching products:', error);
    }
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions globally accessible
window.logout = logout;
window.toggleAuth = toggleAuth;
window.initializeBasketReadyScheduling = initializeBasketReadyScheduling;
window.updateFulfillmentUI = updateFulfillmentUI;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.checkout = checkout;
window.submitConsultation = submitConsultation;
window.filterProducts = filterProducts;
window.performSearch = performSearch;
window.performMobileSearch = performMobileSearch;
window.changeQuantity = changeQuantity;
window.addToCartFromModal = addToCartFromModal;

document.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.style.background = window.scrollY > 50 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 1)';
    }
});

// Mobile Navigation Functions
function initMobileNavigation() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const drawerCloseBtn = document.getElementById('drawerCloseBtn');
    const mobileNavDrawer = document.getElementById('mobileNavDrawer');

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'mobile-drawer-overlay';
    overlay.id = 'mobileDrawerOverlay';
    document.body.appendChild(overlay);

    // Mobile menu button click
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            openMobileDrawer();
        });
    }

    // Close button click
    if (drawerCloseBtn) {
        drawerCloseBtn.addEventListener('click', function() {
            closeMobileDrawer();
        });
    }

    // Overlay click to close
    overlay.addEventListener('click', function() {
        closeMobileDrawer();
    });

    // Close drawer on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeMobileDrawer();
        }
    });

    // Handle navigation link clicks in drawer
    const drawerNavLinks = document.querySelectorAll('.drawer-nav-link');
    drawerNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                closeMobileDrawer();
            }
        });
    });

    // Handle login/logout clicks in drawer
    const mobileLoginLink = document.getElementById('mobileLoginLink');
    const mobileLogoutLink = document.getElementById('mobileLogoutLink');

    if (mobileLoginLink) {
        mobileLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            toggleAuth();
            closeMobileDrawer();
        });
    }

    if (mobileLogoutLink) {
        mobileLogoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
            closeMobileDrawer();
        });
    }

    // Handle Orders & Tracking click
    const ordersTrackingLink = document.querySelector('.drawer-link[onclick="viewOrderTracking()"]');
    if (ordersTrackingLink) {
        ordersTrackingLink.addEventListener('click', function(e) {
            closeMobileDrawer();
        });
    }
}

function openMobileDrawer() {
    const drawer = document.getElementById('mobileNavDrawer');
    const overlay = document.getElementById('mobileDrawerOverlay');

    if (drawer) {
        drawer.classList.add('open');
    }

    if (overlay) {
        overlay.classList.add('active');
    }

    document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobileNavDrawer');
    const overlay = document.getElementById('mobileDrawerOverlay');

    if (drawer) {
        drawer.classList.remove('open');
    }

    if (overlay) {
        overlay.classList.remove('active');
    }

    document.body.style.overflow = '';
}

function updateMobileAuthUI() {
    const mobileLoginLink = document.getElementById('mobileLoginLink');
    const mobileLogoutLink = document.getElementById('mobileLogoutLink');

    if (isAuthenticated && currentUser) {
        if (mobileLoginLink) mobileLoginLink.style.display = 'none';
        if (mobileLogoutLink) mobileLogoutLink.style.display = 'flex';
    } else {
        if (mobileLoginLink) mobileLoginLink.style.display = 'flex';
        if (mobileLogoutLink) mobileLogoutLink.style.display = 'none';
    }
}

function performMobileSearch() {
    const searchInput = document.getElementById('mobileProductSearch');
    if (searchInput && searchInput.value.trim()) {
        document.getElementById('productSearch').value = searchInput.value.trim();
        searchProducts();
        closeMobileDrawer();

        const productsSection = document.getElementById('plants');
        if (productsSection) {
            productsSection.scrollIntoView({ behavior: 'smooth' });
        }
    } else {
        showMessage('Please enter a search term', 'warning');
    }
}

function performSearch() {
    const searchInput = document.getElementById('productSearch');
    if (searchInput && searchInput.value.trim()) {
        searchProducts();
    } else {
        showMessage('Please enter a search term', 'warning');
    }
}

function changeQuantity(delta) {
    const quantityInput = document.getElementById('productQuantity');
    if (quantityInput) {
        const currentQuantity = parseInt(quantityInput.value) || 1;
        const newQuantity = Math.max(1, currentQuantity + delta);
        const maxQuantity = parseInt(quantityInput.getAttribute('max')) || 999;
        quantityInput.value = Math.min(newQuantity, maxQuantity);
    }
}

function addToCartFromModal(productId) {
    const quantityInput = document.getElementById('productQuantity');
    const quantity = parseInt(quantityInput?.value) || 1;

    const product = currentProducts.find(p => p._id === productId);
    if (!product) {
        showErrorMessage('Product not found!');
        return;
    }

    // Check stock availability
    const existingItem = cart.find(item => item.id === productId);
    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    const totalQuantity = currentCartQuantity + quantity;

    if (totalQuantity > product.stock) {
        showErrorMessage(`Sorry! Only ${product.stock} items available in stock.`);
        return;
    }

    // Add to cart
    for (let i = 0; i < quantity; i++) {
        addToCart(productId);
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('productDetailsModal'));
    if (modal) {
        modal.hide();
    }
}