// Admin Dashboard Functionality
let users = [];
let orders = [];
let currentAdminUser = null;
let authToken = null;

const API_BASE_URL = window.location.origin;

// API Helper function for admin
async function adminApiCall(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "API request failed");
        }

        return data;
    } catch (error) {
        console.error("Admin API Error:", error);
        throw error;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    initAdminLogin();
    const addPlantForm = document.getElementById("addPlantForm");
    if (addPlantForm) {
        addPlantForm.addEventListener("submit", handleAddPlant);
    }
});

function initAdminLogin() {
    const adminLoginForm = document.getElementById("adminLoginForm");
    adminLoginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("adminId").value;
        const password = document.getElementById("adminPassword").value;

        try {
            const result = await adminApiCall("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });

            if (result.user.userType === "admin") {
                authToken = result.token;
                currentAdminUser = result.user;

                document.getElementById("adminLogin").classList.add("d-none");
                document
                    .getElementById("adminDashboard")
                    .classList.remove("d-none");
                document.getElementById("userName").textContent =
                    result.user.name;

                await loadDashboardStats();
                await loadCustomers();
                await loadListings();
                await loadOrders();

                showMessage("Login successful! Welcome Admin.", "success");
            } else {
                showMessage(
                    "Access denied. Admin privileges required.",
                    "error",
                );
            }
        } catch (error) {
            showMessage("Invalid credentials. Please try again.", "error");
        }
    });
}

function adminLogout() {
    localStorage.removeItem("currentUser");
    showMessage("Successfully logged out!", "success");
    setTimeout(() => {
        window.location.href = "index.html";
    }, 1000);
}

function showSection(sectionName) {
    document.querySelectorAll(".admin-section").forEach((section) => {
        section.classList.add("d-none");
    });

    document.querySelectorAll(".list-group-item").forEach((item) => {
        item.classList.remove("active");
    });

    document.getElementById(sectionName).classList.remove("d-none");
    event.target.classList.add("active");

    // Load section-specific data
    const sectionLoaders = {
        dashboard: loadDashboardStats,
        inventory: loadInventory,
        orders: loadOrders,
        delivery: loadDeliveryTracking,
        consultations: loadConsultationRequests,
    };

    if (sectionLoaders[sectionName]) {
        sectionLoaders[sectionName]();
    }
}

async function loadDashboardStats() {
    try {
        const result = await adminApiCall("/api/admin/dashboard");

        document.getElementById("totalCustomers").textContent =
            result.stats.totalCustomers;
        document.getElementById("totalPlants").textContent =
            result.stats.totalProducts;
        document.getElementById("totalOrders").textContent =
            result.stats.totalOrders;
        document.getElementById("totalRevenue").textContent =
            `₹${result.stats.totalRevenue.toFixed(2)}`;

        updateAnalytics();
    } catch (error) {
        console.error("Error loading dashboard stats:", error);
        showMessage("Error loading dashboard data", "error");
    }
}

async function loadCustomers() {
    try {
        const customers = await adminApiCall("/api/admin/customers");
        const customersTable = document.getElementById("customersTable");

        if (!customersTable) return;

        if (customers.length === 0) {
            customersTable.innerHTML =
                '<tr><td colspan="6" class="text-center text-muted">No customers found</td></tr>';
            return;
        }

        customersTable.innerHTML = customers
            .map((customer) => {
                const totalOrders = orders.filter(
                    (order) =>
                        order.customerId === customer._id ||
                        order.customerId === customer.id,
                ).length;

                return `
                <tr>
                    <td>${customer.name}</td>
                    <td>${customer.email}</td>
                    <td>${customer.phone || "N/A"}</td>
                    <td>${new Date(customer.registeredAt).toLocaleDateString()}</td>
                    <td><span class="badge bg-info">${totalOrders}</span></td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewCustomerDetails('${customer._id}')">View</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${customer._id}')">Delete</button>
                    </td>
                </tr>
            `;
            })
            .join("");
    } catch (error) {
        console.error("Error loading customers:", error);
        showMessage("Error loading customer data", "error");
        const customersTable = document.getElementById("customersTable");
        if (customersTable) {
            customersTable.innerHTML =
                '<tr><td colspan="6" class="text-center text-danger">Error loading customer data</td></tr>';
        }
    }
}

async function loadListings() {
    try {
        const plants = await adminApiCall("/api/plants");
        const listingsTable = document.getElementById("listingsTable");

        if (plants.length === 0) {
            listingsTable.innerHTML =
                '<tr><td colspan="6" class="text-center text-muted">No plants found</td></tr>';
            return;
        }

        listingsTable.innerHTML = plants
            .map((plant) => {
                return `
                <tr>
                    <td>${plant.name}</td>
                    <td>₹${plant.price}</td>
                    <td><span class="badge bg-info">${plant.category}</span></td>
                    <td>${plant.stock}</td>
                    <td><span class="badge bg-${plant.status === "active" ? "success" : "secondary"}">${plant.status || "active"}</span></td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="toggleListingStatus('${plant._id}')">
                            ${plant.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        <button class="btn btn-sm btn-info" onclick="viewListingDetails('${plant._id}')">View</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteListing('${plant._id}')">Delete</button>
                    </td>
                </tr>
            `;
            })
            .join("");
    } catch (error) {
        console.error("Error loading listings:", error);
        showMessage("Error loading plant listings", "error");
    }
}

async function loadOrders() {
    try {
        const ordersData = await adminApiCall("/api/admin/orders");
        orders = ordersData; // Store locally for easier access in other functions
        const ordersTable = document.getElementById("ordersTable");

        if (orders.length === 0) {
            ordersTable.innerHTML =
                '<tr><td colspan="8" class="text-center text-muted">No orders found</td></tr>';
            return;
        }

        ordersTable.innerHTML = orders
            .map((order) => {
                const paymentStatus = order.paymentStatus || "pending";
                const paymentMethod = order.paymentMethod || "N/A";
                const totalAmount = order.total || 0;
                const deliveryStatus =
                    order.deliveryStatus || order.orderStatus || "pending";
                const orderDate = new Date(
                    order.orderDate || order.createdAt,
                ).toLocaleDateString();

                return `
                <tr>
                    <td><strong>#${order.orderId || order._id.slice(-8)}</strong></td>
                    <td>${order.customerName || "Unknown"}</td>
                    <td>₹${totalAmount.toFixed(2)}</td>
                    <td><span class="badge bg-${paymentStatus === "completed" ? "success" : paymentStatus === "pending" ? "warning" : "danger"}">${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</span></td>
                    <td>${paymentMethod.toUpperCase()}</td>
                    <td><span class="badge bg-${
                        deliveryStatus === "delivered"
                            ? "success"
                            : deliveryStatus === "shipped"
                              ? "info"
                              : deliveryStatus === "processing"
                                ? "warning"
                                : "secondary"
                    }">${deliveryStatus.charAt(0).toUpperCase() + deliveryStatus.slice(1)}</span></td>
                    <td>${orderDate}</td>
                    <td>
                        <div class="d-flex align-items-center gap-1">
                            <button class="btn btn-info btn-sm" onclick="viewOrderDetails('${order._id || order.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-success btn-sm" onclick="updateDeliveryStatus('${order._id || order.id}')" title="Update Status">
                                <i class="fas fa-truck"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteOrder('${order._id || order.id}')" title="Delete Order">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            })
            .join("");
    } catch (error) {
        console.error("Error loading orders:", error);
        showMessage("Error loading order data", "error");
    }
}

async function loadDeliveryTracking() {
    const deliveryTable = document.getElementById("deliveryTable");
    if (!deliveryTable) return;

    try {
        const completedOrders = await adminApiCall(
            "/api/admin/orders?status=completed",
        );

        if (completedOrders.length === 0) {
            deliveryTable.innerHTML =
                '<tr><td colspan="7" class="text-center text-muted">No completed orders for delivery tracking</td></tr>';
            return;
        }

        deliveryTable.innerHTML = completedOrders
            .map((order) => {
                const deliveryStatus = order.deliveryStatus || "pending";
                const statusBadgeClass =
                    deliveryStatus === "delivered"
                        ? "success"
                        : deliveryStatus === "shipped"
                          ? "info"
                          : deliveryStatus === "processing"
                            ? "warning"
                            : "secondary";

                return `
                <tr>
                    <td>#${order.orderId || order._id}</td>
                    <td>${order.customerName}</td>
                    <td>${order.items.length} item(s)</td>
                    <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                    <td>
                        <span class="badge bg-${statusBadgeClass}">
                            ${deliveryStatus.charAt(0).toUpperCase() + deliveryStatus.slice(1)}
                        </span>
                    </td>
                    <td>${order.trackingInfo || "Not available"}</td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-info btn-sm rounded-pill d-flex align-items-center gap-2" onclick="viewOrderDetails('${order._id || order.id}')" title="View Details">
                                <i class="fas fa-eye"></i> <span>View</span>
                            </button>
                            <button class="btn btn-success btn-sm rounded-pill d-flex align-items-center gap-2" onclick="updateDeliveryStatus('${order._id || order.id}')" title="Update Status">
                                <i class="fas fa-edit"></i> <span>Track</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            })
            .join("");
    } catch (error) {
        console.error("Error loading delivery tracking:", error);
        showMessage("Error loading delivery tracking data", "error");
    }
}

async function updateDeliveryStatus(orderId) {
    try {
        // Find order using both _id and id properties
        const order = orders.find((o) => o._id === orderId || o.id === orderId);

        if (!order) {
            showMessage("Order not found!", "error");
            return;
        }

        // Use the MongoDB _id for the API call
        const actualOrderId = order._id || order.id;
        const response = await adminApiCall(
            `/api/admin/orders/${actualOrderId}/status`,
            {
                method: "PUT",
                body: JSON.stringify({ status: "next" }),
            },
        );

        // Update local orders array and refresh the view
        const updatedOrderIndex = orders.findIndex(
            (o) => o._id === orderId || o.id === orderId,
        );
        if (updatedOrderIndex !== -1) {
            orders[updatedOrderIndex] = response.order;
        }

        loadDeliveryTracking();
        loadOrders(); // Reload orders to reflect status changes

        showMessage(
            `Delivery status updated to: ${response.order.deliveryStatus}`,
            "success",
        );
    } catch (error) {
        console.error("Error updating delivery status:", error);
        showMessage("Failed to update delivery status", "error");
    }
}

function deleteOrder(orderId) {
    if (
        confirm(
            "Are you sure you want to delete this order? This action cannot be undone.",
        )
    ) {
        // Find the order to get the actual MongoDB _id
        const order = orders.find((o) => o._id === orderId || o.id === orderId);
        const actualOrderId = order ? order._id || order.id : orderId;

        adminApiCall(`/api/admin/orders/${actualOrderId}`, { method: "DELETE" })
            .then(() => {
                const filteredOrders = orders.filter(
                    (o) => o._id !== orderId && o.id !== orderId,
                );
                orders = filteredOrders; // Update local array

                loadOrders();
                loadDeliveryTracking();
                loadDashboardStats();

                showMessage(`Order has been deleted successfully!`, "success");
            })
            .catch((error) => {
                console.error("Error deleting order:", error);
                showMessage("Failed to delete order", "error");
            });
    }
}

async function viewOrderDetails(orderId) {
    try {
        // Find order from local orders array first, then fetch if needed
        let order = orders.find((o) => o._id === orderId || o.id === orderId);

        if (!order) {
            order = await adminApiCall(`/api/admin/orders/${orderId}`);
        }

        if (!order) {
            showMessage("Order not found!", "error");
            return;
        }

        const modal = document.createElement("div");
        modal.innerHTML = `
            <div class="modal fade" id="orderDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Order Details #${order.orderId || order._id.slice(-8)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Customer Information</h6>
                                    <p><strong>Customer:</strong> ${order.customerName || order.customerId?.name || "N/A"}</p>
                                    <p><strong>Email:</strong> ${order.customerEmail || order.customerId?.email || "N/A"}</p>
                                    <p><strong>Order Date:</strong> ${new Date(order.orderDate || order.createdAt).toLocaleDateString()}</p>
                                    <p><strong>Delivery Status:</strong> 
                                        <span class="badge bg-${
                                            (order.deliveryStatus ||
                                                order.orderStatus) ===
                                            "delivered"
                                                ? "success"
                                                : (order.deliveryStatus ||
                                                        order.orderStatus) ===
                                                    "shipped"
                                                  ? "info"
                                                  : (order.deliveryStatus ||
                                                          order.orderStatus) ===
                                                      "processing"
                                                    ? "warning"
                                                    : "secondary"
                                        }">
                                            ${(order.deliveryStatus || order.orderStatus || "pending").charAt(0).toUpperCase() + (order.deliveryStatus || order.orderStatus || "pending").slice(1)}
                                        </span>
                                    </p>
                                    ${order.trackingInfo ? `<p><strong>Tracking ID:</strong> ${order.trackingInfo}</p>` : ""}

                                    <!-- Customer Contact & Address Information -->
                                    <hr>
                                    <h6>Contact & Address Details</h6>
                                    <p><strong>Contact Name:</strong> ${order.deliveryDetails?.name || order.customerName || "N/A"}</p>
                                    <p><strong>Phone Number:</strong> ${order.deliveryDetails?.phone || order.customerPhone || "N/A"}</p>
                                    <p><strong>Delivery Address:</strong> ${order.deliveryDetails?.address || order.deliveryAddress || "Not provided"}</p>
                                    <p><strong>City:</strong> ${order.deliveryDetails?.city || order.deliveryCity || "Not provided"}</p>
                                    <p><strong>PIN Code:</strong> ${order.deliveryDetails?.pin || order.deliveryPin || "Not provided"}</p>
                                    ${
                                        order.deliveryDetails?.notes ||
                                        order.specialInstructions ||
                                        order.deliveryNotes
                                            ? `<p><strong>Special Notes:</strong> ${order.deliveryDetails?.notes || order.specialInstructions || order.deliveryNotes}</p>`
                                            : ""
                                    }

                                    <!-- Basket Ready Schedule Information -->
                                    ${
                                        order.basketReady
                                            ? `
                                        <hr>
                                        <h6 class="text-success"><i class="fas fa-calendar-alt me-2"></i>Basket Ready Schedule</h6>
                                        <p><strong>Fulfillment Type:</strong> ${order.basketReady.fulfillmentType === "delivery" ? "Home Delivery" : "Store Pickup"}</p>
                                        <p><strong>Scheduled Date:</strong> ${new Date(order.basketReady.preferredDate).toLocaleDateString()}</p>
                                        <p><strong>Time Slot:</strong> ${order.basketReady.preferredTime}</p>
                                        ${order.basketReady.specialInstructions ? `<p><strong>Special Instructions:</strong> ${order.basketReady.specialInstructions}</p>` : ""}
                                    `
                                            : ""
                                    }
                                </div>
                                <div class="col-md-6">
                                    <h6>Payment Information</h6>
                                    <p><strong>Payment Method:</strong> ${order.paymentMethod || "N/A"}</p>
                                    <p><strong>Payment Status:</strong> <span class="badge bg-${order.paymentStatus === "completed" ? "success" : "warning"}">${order.paymentStatus || "pending"}</span></p>
                                    <p><strong>Transaction ID:</strong> ${order.transactionId || "N/A"}</p>
                                    <p><strong>Total Amount:</strong> ₹${order.total?.toFixed(2) || "0.00"}</p>
                                    <p><strong>Subtotal:</strong> ₹${order.subtotal?.toFixed(2) || "0.00"}</p>
                                    <p><strong>Shipping:</strong> ₹${order.shipping?.toFixed(2) || "0.00"}</p>
                                    <p><strong>Tax:</strong> ₹${order.tax?.toFixed(2) || "0.00"}</p>
                                    ${order.codCharge ? `<p><strong>COD Charge:</strong> ₹${order.codCharge?.toFixed(2)}</p>` : ""}
                                </div>
                            </div>
                            <div class="mt-3">
                                <h6>Order Items</h6>
                                <ul class="list-group">
                                    ${order.items
                                        .map(
                                            (item) => `
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            ${item.name} (x${item.quantity})
                                            <span class="text-success">₹${(item.price * item.quantity).toFixed(2)}</span>
                                        </li>
                                    `,
                                        )
                                        .join("")}
                                </ul>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            ${
                                order.paymentStatus === "completed" ||
                                order.paymentStatus === "pending"
                                    ? `<button type="button" class="btn btn-success" onclick="updateDeliveryStatus('${order._id || order.id}')">Update Delivery Status</button>`
                                    : ""
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const orderModal = new bootstrap.Modal(
            document.getElementById("orderDetailsModal"),
        );
        orderModal.show();

        document
            .getElementById("orderDetailsModal")
            .addEventListener("hidden.bs.modal", function () {
                document.body.removeChild(modal);
            });
    } catch (error) {
        console.error("Error viewing order details:", error);
        showMessage("Error loading order details", "error");
    }
}

async function toggleListingStatus(plantId) {
    try {
        const plant = await adminApiCall(`/api/plants/${plantId}/status`, {
            method: "PUT",
        });
        loadListings();
        loadDashboardStats();
        const statusText =
            plant.status === "active" ? "activated" : "deactivated";
        showMessage(
            `Plant "${plant.name}" ${statusText} successfully!`,
            "success",
        );

        if (
            window.location.pathname.endsWith("index.html") ||
            window.location.pathname === "/" ||
            window.location.pathname === "/index.html"
        ) {
            if (typeof loadProductCatalog === "function") {
                loadProductCatalog();
            }
        }
    } catch (error) {
        console.error("Error toggling plant status:", error);
        showMessage("Failed to toggle plant status", "error");
    }
}

async function viewListingDetails(plantId) {
    try {
        const plant = await adminApiCall(`/api/plants/${plantId}`);
        if (plant) {
            showMessage(
                `Plant Details:
Plant Name: ${plant.name}
Price: ₹${plant.price}
Category: ${plant.category}
Stock: ${plant.stock}
Status: ${plant.status}
Description: ${plant.description || "No description available"}`,
                "info",
            );
        } else {
            showMessage("Plant not found!", "error");
        }
    } catch (error) {
        console.error("Error viewing plant details:", error);
        showMessage("Error loading plant details", "error");
    }
}

function showMessage(message, type = "success") {
    const alert = document.createElement("div");
    alert.className = `alert alert-${type === "success" ? "success" : type === "error" ? "danger" : "info"} alert-dismissible fade show position-fixed`;
    alert.style.cssText =
        "top: 100px; right: 20px; z-index: 9999; max-width: 350px;";
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}

async function deleteListing(plantId) {
    if (
        confirm(
            "Are you sure you want to permanently delete this plant? This action cannot be undone.",
        )
    ) {
        try {
            await adminApiCall(`/api/plants/${plantId}`, { method: "DELETE" });
            loadListings();
            loadDashboardStats();
            showMessage("Plant deleted successfully!", "success");
        } catch (error) {
            console.error("Error deleting plant:", error);
            showMessage("Failed to delete plant", "error");
        }
    }
}

// Analytics Charts
let revenueChart = null;
let revenuePieChart = null;
let categoryChart = null;

async function updateAnalytics() {
    try {
        const analytics = await adminApiCall("/api/admin/analytics");
        const stats = await adminApiCall("/api/admin/dashboard");
        const plants = await adminApiCall("/api/plants");

        const indoorPlants = plants.filter((plant) => plant.category === "Indoor").length;
        const outdoorPlants = plants.filter((plant) => plant.category === "Outdoor").length;
        const totalRevenue = stats.stats.totalRevenue || 0;
        const completedOrders = stats.stats.completedOrders || 0;
        const totalOrders = stats.stats.totalOrders || 0;

        // Update quick stats
        document.getElementById("todayRevenue").textContent = `₹${analytics.todayRevenue.toFixed(2)}`;
        document.getElementById("monthRevenue").textContent = `₹${analytics.monthRevenue.toFixed(2)}`;
        document.getElementById("yearRevenue").textContent = `₹${analytics.yearRevenue.toFixed(2)}`;



        // Update revenue breakdown table
        updateRevenueBreakdownTable(analytics.revenueBreakdown);

        // Initialize or update charts
        await updateAnalyticsData();
    } catch (error) {
        console.error("Error updating analytics:", error);
        showMessage("Error updating analytics data", "error");
    }
}

async function updateAnalyticsData() {
    try {
        const timeframe = document.getElementById("analyticsTimeframe")?.value || "daily";
        const metric = document.getElementById("analyticsMetric")?.value || "revenue";

        const analytics = await adminApiCall(`/api/admin/analytics?timeframe=${timeframe}&metric=${metric}`);

        // Update revenue trend chart
        updateRevenueChart(analytics.chartData, timeframe, metric);

        // Update revenue distribution pie chart
        updateRevenuePieChart(analytics.distributionData);

        // Update category performance chart
        updateCategoryChart(analytics.categoryData);

    } catch (error) {
        console.error("Error updating analytics data:", error);
        showMessage("Error updating analytics charts", "error");
    }
}

function updateRevenueChart(data, timeframe, metric) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    if (revenueChart) {
        revenueChart.destroy();
    }

    const labels = data.labels || [];
    const values = data.values || [];

    let title = "Revenue";
    let yAxisLabel = "Amount (₹)";
    let backgroundColor = 'rgba(54, 162, 235, 0.2)';
    let borderColor = 'rgba(54, 162, 235, 1)';

    if (metric === "orders") {
        title = "Orders";
        yAxisLabel = "Number of Orders";
        backgroundColor = 'rgba(255, 99, 132, 0.2)';
        borderColor = 'rgba(255, 99, 132, 1)';
    } else if (metric === "customers") {
        title = "New Customers";
        yAxisLabel = "Number of Customers";
        backgroundColor = 'rgba(75, 192, 192, 0.2)';
        borderColor = 'rgba(75, 192, 192, 1)';
    }

    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${title} (${timeframe})`,
                data: values,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: yAxisLabel
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: timeframe === 'daily' ? 'Days' : timeframe === 'monthly' ? 'Months' : 'Years'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `${title} Trend - ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}`
                }
            }
        }
    });
}

function updateRevenuePieChart(data) {
    const ctx = document.getElementById('revenuePieChart');
    if (!ctx) return;

    if (revenuePieChart) {
        revenuePieChart.destroy();
    }

    const labels = data.labels || ['Today', 'This Month', 'This Year'];
    const values = data.values || [0, 0, 0];

    revenuePieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 205, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Revenue Distribution'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (categoryChart) {
        categoryChart.destroy();
    }

    const labels = data.labels || ['Indoor Plants', 'Outdoor Plants'];
    const revenues = data.revenues || [0, 0];
    const orders = data.orders || [0, 0];

    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₹)',
                data: revenues,
                backgroundColor: 'rgba(75, 192, 192, 0.8)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                yAxisID: 'y'
            }, {
                label: 'Orders',
                data: orders,
                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Revenue (₹)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Number of Orders'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Performance by Plant Category'
                }
            }
        }
    });
}

function updateRevenueBreakdownTable(breakdown) {
    const table = document.getElementById("revenueBreakdownTable");
    if (!table || !breakdown) return;

    table.innerHTML = breakdown.map(item => `
        <tr>
            <td>${item.period}</td>
            <td>₹${item.revenue.toFixed(2)}</td>
            <td>${item.orders}</td>
        </tr>
    `).join("");
}

async function viewCustomerDetails(userId) {
    try {
        const user = await adminApiCall(`/api/admin/customers/${userId}`);
        if (user) {
            const customerOrders = await adminApiCall(
                `/api/admin/orders?customerId=${userId}`,
            ); // Fetch orders for this customer
            const totalSpent = customerOrders.reduce(
                (sum, order) => sum + (order.total || 0),
                0,
            );

            showMessage(
                `Customer Details:
Name: ${user.name}
Email: ${user.email}
Phone: ${user.phone || "N/A"}
Registered: ${new Date(user.registeredAt).toLocaleDateString()}
Total Orders: ${customerOrders.length}
Total Spent: ₹${totalSpent.toFixed(2)}`,
                "info",
            );
        } else {
            showMessage("Customer not found!", "error");
        }
    } catch (error) {
        console.error("Error viewing customer details:", error);
        showMessage("Error loading customer details", "error");
    }
}

async function deleteCustomer(userId) {
    if (
        confirm(
            "Are you sure you want to delete this customer? This action cannot be undone.",
        )
    ) {
        try {
            await adminApiCall(`/api/admin/customers/${userId}`, {
                method: "DELETE",
            });
            users = users.filter((u) => u.id !== userId); // Update local array if needed elsewhere
            loadCustomers();
            loadDashboardStats();
            showMessage("Customer deleted successfully!", "success");
        } catch (error) {
            console.error("Error deleting customer:", error);
            showMessage("Failed to delete customer", "error");
        }
    }
}

async function handleAddPlant(e) {
    e.preventDefault();

    const plantData = {
        name: document.getElementById("plantName").value,
        price: parseFloat(document.getElementById("plantPrice").value),
        category: document.getElementById("plantCategory").value,
        stock: parseInt(document.getElementById("plantStock").value),
        description: document.getElementById("plantDescription").value,
        image: document.getElementById("plantImage").value,
        status: "active",
    };

    try {
        await adminApiCall("/api/plants", {
            method: "POST",
            body: JSON.stringify(plantData),
        });

        document.getElementById("addPlantForm").reset();
        loadListings();
        loadInventory();
        loadDashboardStats();

        showMessage("Plant added successfully!", "success");
        showSection("listings"); // Switch to listings view after adding

        if (
            window.location.pathname.endsWith("index.html") ||
            window.location.pathname === "/" ||
            window.location.pathname === "/index.html"
        ) {
            if (typeof loadProductCatalog === "function") {
                loadProductCatalog();
            }
        }
    } catch (error) {
        console.error("Error adding plant:", error);
        showMessage("Failed to add plant. Please check the details.", "error");
    }
}

async function loadInventory() {
    try {
        const plants = await adminApiCall("/api/plants");
        const inventoryTable = document.getElementById("inventoryTable");

        if (plants.length === 0) {
            inventoryTable.innerHTML =
                '<tr><td colspan="5" class="text-center text-muted">No inventory items</td></tr>';
            return;
        }

        inventoryTable.innerHTML = plants
            .map(
                (plant) => `
            <tr>
                <td>${plant.name}</td>
                <td>${plant.stock}</td>
                <td>5</td>
                <td>
                    <span class="badge bg-${plant.stock < 5 ? "danger" : plant.stock < 10 ? "warning" : "success"}">
                        ${plant.stock < 5 ? "Low Stock" : plant.stock < 10 ? "Medium" : "Good"}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="updateStock('${plant._id}')">Update Stock</button>
                </td>
            </tr>
        `,
            )
            .join("");
    } catch (error) {
        console.error("Error loading inventory:", error);
        showMessage("Error loading inventory data", "error");
    }
}

async function updateStock(plantId) {
    try {
        const plant = await adminApiCall(`/api/plants/${plantId}`);
        if (plant) {
            const newStock = prompt("Enter new stock quantity:", plant.stock);
            if (newStock && !isNaN(newStock) && parseInt(newStock) >= 0) {
                await adminApiCall(`/api/plants/${plantId}`, {
                    method: "PUT",
                    body: JSON.stringify({ stock: parseInt(newStock) }),
                });
                loadInventory();
                loadListings();
                loadDashboardStats();
                showMessage("Stock updated successfully!", "success");
            } else if (newStock !== null) {
                showMessage(
                    "Please enter a valid stock quantity (0 or greater)",
                    "error",
                );
            }
        } else {
            showMessage("Plant not found!", "error");
        }
    } catch (error) {
        console.error("Error updating stock:", error);
        showMessage("Failed to update stock: " + error.message, "error");
    }
}

async function loadConsultationRequests() {
    const table = document.getElementById("consultationRequestsTable");
    try {
        let requests = await adminApiCall("/api/consultations");
        if (!table) return;
        if (requests.length === 0) {
            table.innerHTML =
                '<tr><td colspan="7" class="text-center text-muted">No consultation requests found</td></tr>';
            return;
        }
        table.innerHTML = requests
            .map(
                (req, idx) => `
            <tr${req.status === "done" ? ' class="table-success"' : ""}>
                <td>${idx + 1}</td>
                <td>${req.name}</td>
                <td>${req.email}</td>
                <td style="max-width: 300px; word-wrap: break-word;">${req.message}</td>
                <td>${new Date(req.createdAt || req.date).toLocaleDateString()} ${new Date(req.createdAt || req.date).toLocaleTimeString()}</td>
                <td><span class="badge bg-${req.status === "done" ? "success" : "warning"}">${req.status === "done" ? "Done" : "Pending"}</span></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-success" onclick="markConsultationDone(${idx})" ${req.status === "done" ? "disabled" : ""}>Mark as Done</button>
                        <button class="btn btn-sm btn-danger ms-2" onclick="deleteConsultationRequest(${idx})">Delete</button>
                    </div>
                </td>
            </tr>
        `,
            )
            .join("");
    } catch (error) {
        console.error("Error loading consultation requests:", error);
        showMessage("Error loading consultation requests", "error");
        if (table) {
            table.innerHTML =
                '<tr><td colspan="7" class="text-center text-danger">Error loading consultation requests</td></tr>';
        }
    }
}

async function markConsultationDone(idx) {
    try {
        let requests = await adminApiCall("/api/consultations");
        if (requests[idx]) {
            const updatedRequest = await adminApiCall(
                `/api/consultations/${requests[idx]._id}`,
                {
                    method: "PUT",
                    body: JSON.stringify({ status: "done" }),
                },
            );
            loadConsultationRequests();
            showMessage("Consultation marked as done successfully!", "success");
        }
    } catch (error) {
        console.error("Error marking consultation as done:", error);
        showMessage("Failed to update consultation status", "error");
    }
}

async function deleteConsultationRequest(idx) {
    if (confirm("Are you sure you want to delete this consultation request?")) {
        try {
            let requests = await adminApiCall("/api/consultations");
            if (requests[idx]) {
                await adminApiCall(`/api/consultations/${requests[idx]._id}`, {
                    method: "DELETE",
                });
                loadConsultationRequests();
                showMessage(
                    "Consultation request deleted successfully!",
                    "success",
                );
            }
        } catch (error) {
            console.error("Error deleting consultation request:", error);
            showMessage("Failed to delete consultation request", "error");
        }
    }
}

// Make functions globally accessible
window.deleteListing = deleteListing;
window.updateAnalytics = updateAnalytics;
window.updateAnalyticsData = updateAnalyticsData;
window.toggleListingStatus = toggleListingStatus;
window.viewListingDetails = viewListingDetails;
window.viewOrderDetails = viewOrderDetails;
window.viewCustomerDetails = viewCustomerDetails;
window.deleteCustomer = deleteCustomer;
window.handleAddPlant = handleAddPlant;
window.loadInventory = loadInventory;
window.updateStock = updateStock;
window.loadDeliveryTracking = loadDeliveryTracking;
window.updateDeliveryStatus = updateDeliveryStatus;
window.deleteOrder = deleteOrder;
window.showSection = showSection;
window.adminLogout = adminLogout;
window.loadConsultationRequests = loadConsultationRequests;
window.markConsultationDone = markConsultationDone;
window.deleteConsultationRequest = deleteConsultationRequest;
