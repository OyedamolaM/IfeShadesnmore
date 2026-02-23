import { useEffect, useMemo, useState } from "react";
import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";
import { AUDIENCE_OPTIONS, BULLET_ICON_TYPES, DEFAULT_SETTINGS } from "../../constants/storefront";
import {
  deleteAdminCustomer,
  fetchAdminCustomers,
  fetchAllOrders,
  fetchSubscriptions,
  updateOrderStatus
} from "../../utils/api";

const ADMIN_TABS = [
  { id: "orders", label: "Orders" },
  { id: "customers", label: "Customers" },
  { id: "subscribers", label: "Subscribers" },
  { id: "products", label: "Products" },
  { id: "settings", label: "Settings" }
];

const ORDER_STATUS_OPTIONS = ["pending", "processing", "shipped", "delivered", "cancelled"];

function normalizeAudienceSelections(value) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(normalized.filter((entry) => AUDIENCE_OPTIONS.some((opt) => opt.value === entry)))];
  return unique.length > 0 ? unique : ["unisex"];
}

function formatAudienceLabel(value) {
  const option = AUDIENCE_OPTIONS.find((entry) => entry.value === value);
  return option ? option.label : String(value || "Unisex");
}

function AdminOverlay({
  currentUser,
  settingsDraft,
  onSettingsDraftChange,
  onSaveSettings,
  onHeroUpload,
  productDraft,
  onProductDraftChange,
  onProductSubmit,
  onProductUpload,
  isEditing,
  onCancelEdit,
  products,
  onStartEdit,
  onRemoveProduct,
  adminMessage,
  onOpenStorefront,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState("orders");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [orderStatusDrafts, setOrderStatusDrafts] = useState({});
  const [orderStatusNotice, setOrderStatusNotice] = useState("");
  const [orderStatusError, setOrderStatusError] = useState("");
  const [customerActionNotice, setCustomerActionNotice] = useState("");
  const [customerActionError, setCustomerActionError] = useState("");

  const selectedAudiences = useMemo(
    () => normalizeAudienceSelections(productDraft.audiences),
    [productDraft.audiences]
  );

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoadingData(true);
      setDataError("");
      try {
        const [ordersPayload, customersPayload, subscriptionsPayload] = await Promise.all([
          fetchAllOrders(),
          fetchAdminCustomers(),
          fetchSubscriptions()
        ]);

        if (!isMounted) return;

        const nextOrders = Array.isArray(ordersPayload?.orders) ? ordersPayload.orders : [];
        setOrders(nextOrders);
        setCustomers(Array.isArray(customersPayload?.customers) ? customersPayload.customers : []);
        setSubscriptions(
          Array.isArray(subscriptionsPayload?.subscriptions) ? subscriptionsPayload.subscriptions : []
        );

        setOrderStatusDrafts(
          nextOrders.reduce((acc, order) => {
            acc[order.id] = order.orderStatus || "pending";
            return acc;
          }, {})
        );
      } catch (requestError) {
        if (!isMounted) return;
        setDataError(requestError.message || "Could not load admin data.");
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalRevenue = useMemo(
    () =>
      orders
        .filter((order) => order.paymentStatus === "paid")
        .reduce((sum, order) => sum + (Number(order.subtotal) || 0), 0),
    [orders]
  );

  const pendingOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["pending", "processing"].includes(String(order.orderStatus || "pending"))
      ).length,
    [orders]
  );

  const handleOrderStatusSave = async (orderId) => {
    const nextStatus = orderStatusDrafts[orderId] || "pending";
    setOrderStatusNotice("");
    setOrderStatusError("");

    try {
      const payload = await updateOrderStatus(orderId, nextStatus);
      const updatedOrder = payload?.order;
      if (!updatedOrder) throw new Error("Could not update order status.");

      setOrders((current) => current.map((order) => (order.id === orderId ? updatedOrder : order)));
      setOrderStatusNotice(`Order ${orderId} updated to ${nextStatus}.`);
    } catch (requestError) {
      setOrderStatusError(requestError.message || "Could not update order status.");
    }
  };

  const handleDeleteCustomer = async (customer) => {
    const label = customer.fullName?.trim() || customer.email;
    const shouldDelete = window.confirm(
      `Delete customer "${label}"? This will also delete their orders and cannot be undone.`
    );
    if (!shouldDelete) return;

    setCustomerActionNotice("");
    setCustomerActionError("");

    try {
      const removedOrderIds = orders
        .filter((order) => Number(order.userId) === Number(customer.id))
        .map((order) => String(order.id));

      await deleteAdminCustomer(customer.id);
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setOrders((current) => current.filter((order) => Number(order.userId) !== Number(customer.id)));
      if (removedOrderIds.length > 0) {
        setOrderStatusDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([orderId]) => !removedOrderIds.includes(String(orderId)))
          )
        );
      }
      setCustomerActionNotice(`Customer "${label}" was removed.`);
    } catch (requestError) {
      setCustomerActionError(requestError.message || "Could not delete customer.");
    }
  };

  const toggleAudienceSelection = (audience, checked) => {
    const current = normalizeAudienceSelections(productDraft.audiences);
    let next;

    if (checked) {
      next = [...new Set([...current, audience])];
    } else {
      next = current.filter((entry) => entry !== audience);
      if (next.length === 0) next = ["unisex"];
    }

    onProductDraftChange("audiences", next);
    onProductDraftChange("audience", next[0]);
  };

  const updateSettingsBullet = (group, index, field, value) => {
    const fallback =
      group === "heroPromiseItems"
        ? DEFAULT_SETTINGS.heroPromiseItems
        : DEFAULT_SETTINGS.featureItems;
    const currentItems = Array.isArray(settingsDraft[group]) && settingsDraft[group].length > 0
      ? settingsDraft[group]
      : fallback;

    const nextItems = currentItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    );
    onSettingsDraftChange(group, nextItems);
  };

  return (
    <div className="page admin-page">
      <div className="site-shell admin-shell">
        <header className="admin-topbar">
          <div>
            <h1>Admin Dashboard</h1>
            <p>
              Signed in as <strong>{currentUser?.email || "admin"}</strong>
            </p>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" className="secondary-action" onClick={onOpenStorefront}>
              View Storefront
            </button>
            <button type="button" className="secondary-action" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="admin-kpi-grid">
          <article className="admin-kpi-card">
            <h2>{orders.length}</h2>
            <p>Total Orders</p>
          </article>
          <article className="admin-kpi-card">
            <h2>{pendingOrders}</h2>
            <p>Pending/Processing</p>
          </article>
          <article className="admin-kpi-card">
            <h2>{toPrice(totalRevenue)}</h2>
            <p>Paid Revenue</p>
          </article>
          <article className="admin-kpi-card">
            <h2>{customers.length}</h2>
            <p>Customers</p>
          </article>
        </section>

        <nav className="admin-tabs" aria-label="Admin sections">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {isLoadingData ? <p className="admin-hint">Loading admin data...</p> : null}
        {dataError ? <p className="form-error">{dataError}</p> : null}
        {orderStatusNotice ? <p className="form-success">{orderStatusNotice}</p> : null}
        {orderStatusError ? <p className="form-error">{orderStatusError}</p> : null}
        {customerActionNotice ? <p className="form-success">{customerActionNotice}</p> : null}
        {customerActionError ? <p className="form-error">{customerActionError}</p> : null}
        {adminMessage ? <p className="form-success">{adminMessage}</p> : null}

        <div className="admin-sections">
          {activeTab === "orders" ? (
            <section className="admin-section-card">
              <header className="admin-section-header">
                <h2>Orders</h2>
                <p>Manage fulfillment status, payment details, and delivery information.</p>
              </header>

              <div className="admin-order-list">
                {orders.length === 0 ? <p className="admin-hint">No orders yet.</p> : null}
                {orders.map((order) => (
                  <article className="admin-order-card" key={order.id}>
                    <div className="admin-order-main">
                      <div>
                        <h3>{order.id}</h3>
                        <p>
                          {new Date(order.createdAt).toLocaleString()} | {toPrice(order.subtotal)}
                        </p>
                      </div>
                      <div className="admin-status-row">
                        <span className={`order-status status-${order.paymentStatus}`}>
                          Payment: {order.paymentStatus}
                        </span>
                        <label>
                          Order status
                          <select
                            value={orderStatusDrafts[order.id] || order.orderStatus || "pending"}
                            onChange={(event) =>
                              setOrderStatusDrafts((current) => ({
                                ...current,
                                [order.id]: event.target.value
                              }))
                            }
                          >
                            {ORDER_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => handleOrderStatusSave(order.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="admin-order-meta-grid">
                      <div>
                        <h4>Delivery</h4>
                        <p>{order.fullName}</p>
                        <p>{order.phone}</p>
                        <p>
                          {order.address}, {order.city}
                        </p>
                      </div>
                      <div>
                        <h4>Payment</h4>
                        <p>Method: {order.paymentMethod}</p>
                        <p>Channel: {order.paymentChannel || "-"}</p>
                        <p>Reference: {order.paymentReference}</p>
                      </div>
                    </div>

                    <div className="admin-order-items">
                      <h4>Items</h4>
                      <ul>
                        {(order.items || []).map((item) => (
                          <li key={`${order.id}-${item.id || item.productId}`}>
                            <span>
                              {item.name} x {item.quantity}
                            </span>
                            <strong>{toPrice(item.lineTotal)}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "customers" ? (
            <section className="admin-section-card">
              <header className="admin-section-header">
                <h2>Customers</h2>
                <p>People registered as customer accounts.</p>
              </header>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>City</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No customers yet.</td>
                      </tr>
                    ) : (
                      customers.map((customer) => (
                        <tr key={customer.id}>
                          <td>{customer.fullName || "-"}</td>
                          <td>{customer.email}</td>
                          <td>{customer.phone || "-"}</td>
                          <td>{customer.city || "-"}</td>
                          <td>{customer.orderCount}</td>
                          <td>{toPrice(customer.totalSpent)}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary-action danger-action"
                              onClick={() => handleDeleteCustomer(customer)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "subscribers" ? (
            <section className="admin-section-card">
              <header className="admin-section-header">
                <h2>Subscribers</h2>
                <p>Email list from your "Stay Updated" form.</p>
              </header>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Source</th>
                      <th>Subscribed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No subscribers yet.</td>
                      </tr>
                    ) : (
                      subscriptions.map((subscription) => (
                        <tr key={subscription.id}>
                          <td>{subscription.email}</td>
                          <td>{subscription.source}</td>
                          <td>{new Date(subscription.createdAt).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "products" ? (
            <section className="admin-section-grid">
              <form className="admin-section-card admin-form-card" onSubmit={onProductSubmit}>
                <header className="admin-section-header">
                  <h2>{isEditing ? "Edit Product" : "Add Product"}</h2>
                  <p>Create and update products in each collection.</p>
                </header>
                <label>
                  Product name
                  <input
                    value={productDraft.name}
                    onChange={(event) => onProductDraftChange("name", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Price (NGN)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productDraft.price}
                    onChange={(event) => onProductDraftChange("price", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Placement
                  <select
                    value={productDraft.section}
                    onChange={(event) => onProductDraftChange("section", event.target.value)}
                  >
                    <option value="category">Top category cards</option>
                    <option value="bestseller">Best sellers row</option>
                  </select>
                </label>
                <label>
                  Audience sections (multi-select)
                  <div className="admin-audience-multi">
                    {AUDIENCE_OPTIONS.map((option) => (
                      <label key={option.value} className="admin-audience-option">
                        <input
                          type="checkbox"
                          checked={selectedAudiences.includes(option.value)}
                          onChange={(event) => toggleAudienceSelection(option.value, event.target.checked)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </label>
                <label>
                  Product description
                  <input
                    placeholder="Short product details"
                    value={productDraft.description}
                    onChange={(event) => onProductDraftChange("description", event.target.value)}
                  />
                </label>
                <label>
                  Fallback frame style
                  <select
                    value={productDraft.variant}
                    onChange={(event) => onProductDraftChange("variant", event.target.value)}
                  >
                    <option value="round">Round</option>
                    <option value="tortoise">Tortoise</option>
                    <option value="cat">Cat-Eye</option>
                    <option value="clear">Clear</option>
                    <option value="square">Square</option>
                    <option value="aviator">Aviator</option>
                  </select>
                </label>
                <label>
                  Product image URL
                  <input
                    placeholder="https://..."
                    value={productDraft.image}
                    onChange={(event) => onProductDraftChange("image", event.target.value)}
                  />
                </label>
                <label>
                  Or upload product image
                  <input type="file" accept="image/*" onChange={onProductUpload} />
                </label>

                <div className="admin-inline-actions">
                  <button type="submit" className="primary-action">
                    {isEditing ? "Update Product" : "Add Product"}
                  </button>
                  {isEditing ? (
                    <button type="button" className="secondary-action" onClick={onCancelEdit}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>

              <section className="admin-section-card admin-list-card">
                <header className="admin-section-header">
                  <h2>Current Products</h2>
                  <p>Tap edit to modify product details quickly.</p>
                </header>

                <ul className="admin-product-list">
                  {products.map((product) => (
                    <li key={product.id}>
                      <div className="mini-media">
                        <ProductMedia product={product} />
                      </div>
                      <div>
                        <strong>{product.name}</strong>
                        <span>
                          {toPrice(product.price)} | {product.section} |{" "}
                          {normalizeAudienceSelections(product.audiences || [product.audience])
                            .map((entry) => formatAudienceLabel(entry))
                            .join(", ")}
                        </span>
                      </div>
                      <div className="admin-list-actions">
                        <button type="button" className="secondary-action" onClick={() => onStartEdit(product)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary-action danger-action"
                          onClick={() => onRemoveProduct(product.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          ) : null}

          {activeTab === "settings" ? (
            <section className="admin-section-card admin-form-card">
              <header className="admin-section-header">
                <h2>Store Settings</h2>
                <p>Update brand text and hero section content.</p>
              </header>

              <form onSubmit={onSaveSettings} className="admin-settings-form">
                <label>
                  Brand name
                  <input
                    value={settingsDraft.brandName}
                    onChange={(event) => onSettingsDraftChange("brandName", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Brand tagline
                  <input
                    value={settingsDraft.brandTagline}
                    onChange={(event) => onSettingsDraftChange("brandTagline", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Hero title
                  <input
                    value={settingsDraft.heroTitle}
                    onChange={(event) => onSettingsDraftChange("heroTitle", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Hero subtitle
                  <input
                    value={settingsDraft.heroSubtitle}
                    onChange={(event) => onSettingsDraftChange("heroSubtitle", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Hero button label
                  <input
                    value={settingsDraft.heroButtonLabel}
                    onChange={(event) => onSettingsDraftChange("heroButtonLabel", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Hero image URL
                  <input
                    placeholder="https://..."
                    value={settingsDraft.heroImage}
                    onChange={(event) => onSettingsDraftChange("heroImage", event.target.value)}
                  />
                </label>
                <div className="admin-bullet-editor">
                  <h3>Hero benefit bullets</h3>
                  {(Array.isArray(settingsDraft.heroPromiseItems) && settingsDraft.heroPromiseItems.length > 0
                    ? settingsDraft.heroPromiseItems
                    : DEFAULT_SETTINGS.heroPromiseItems
                  ).map((item, index) => (
                    <div className="admin-bullet-row" key={`hero-bullet-${index}`}>
                      <label>
                        Icon
                        <select
                          value={item.type}
                          onChange={(event) =>
                            updateSettingsBullet("heroPromiseItems", index, "type", event.target.value)
                          }
                        >
                          {BULLET_ICON_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Title
                        <input
                          value={item.title}
                          onChange={(event) =>
                            updateSettingsBullet("heroPromiseItems", index, "title", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        Subtitle
                        <input
                          value={item.description}
                          onChange={(event) =>
                            updateSettingsBullet("heroPromiseItems", index, "description", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="admin-bullet-editor">
                  <h3>Why choose us bullets</h3>
                  {(Array.isArray(settingsDraft.featureItems) && settingsDraft.featureItems.length > 0
                    ? settingsDraft.featureItems
                    : DEFAULT_SETTINGS.featureItems
                  ).map((item, index) => (
                    <div className="admin-bullet-row" key={`feature-bullet-${index}`}>
                      <label>
                        Icon
                        <select
                          value={item.type}
                          onChange={(event) =>
                            updateSettingsBullet("featureItems", index, "type", event.target.value)
                          }
                        >
                          {BULLET_ICON_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Title
                        <input
                          value={item.title}
                          onChange={(event) =>
                            updateSettingsBullet("featureItems", index, "title", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        Subtitle
                        <input
                          value={item.description}
                          onChange={(event) =>
                            updateSettingsBullet("featureItems", index, "description", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <label>
                  Or upload hero image
                  <input type="file" accept="image/*" onChange={onHeroUpload} />
                </label>
                <button type="submit" className="primary-action">
                  Save Settings
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AdminOverlay;
