import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import ProductMedia from "../components/product/ProductMedia";
import {
  addWishlistItem,
  createAccountAddress,
  deleteAccountAddress,
  fetchAccountDashboard,
  logout,
  removeWishlistItem,
  setDefaultAccountAddress,
  updateAccountAddress,
  updateAccountPreferences,
  updatePassword,
  updateProfile
} from "../utils/api";
import { toPrice } from "../utils/format";

const ACCOUNT_TABS = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "orders", label: "My orders", icon: "box" },
  { id: "wishlist", label: "Wishlist", icon: "heart" },
  { id: "addresses", label: "Addresses", icon: "pin" },
  { id: "profile", label: "Profile", icon: "user" }
];

const ORDER_TABS = ["All", "Active", "Delivered", "Cancelled"];
function AccountIcon({ name }) {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  };
  if (name === "grid") return <svg {...shared}><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></svg>;
  if (name === "box") return <svg {...shared}><path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" /><path d="M4 7.5v9L12 21l8-4.5v-9" /><path d="M12 12v9" /></svg>;
  if (name === "heart") return <svg {...shared}><path d="M20.8 8.6c0 5-8.8 10-8.8 10s-8.8-5-8.8-10A4.8 4.8 0 0 1 12 5a4.8 4.8 0 0 1 8.8 3.6Z" /></svg>;
  if (name === "pin") return <svg {...shared}><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" /><path d="M12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg>;
  if (name === "user") return <svg {...shared}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
  if (name === "bell") return <svg {...shared}><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
  if (name === "logout") return <svg {...shared}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
  if (name === "plus") return <svg {...shared}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
  if (name === "edit") return <svg {...shared}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
  if (name === "trash") return <svg {...shared}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></svg>;
  if (name === "shop") return <svg {...shared}><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>;
  return <svg {...shared}><path d="M5 12h14" /></svg>;
}

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "in_stock" || source === "out_of_stock" || source === "preorder") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-NG", { month: "short", day: "2-digit", year: "numeric" });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-NG", { month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getOrderTotal(order) {
  return (Number(order?.subtotal) || 0) + (Number(order?.shippingFee) || 0);
}

function getOrderLabel(order) {
  const paymentStatus = String(order?.paymentStatus || "pending").toLowerCase();
  const orderStatus = String(order?.orderStatus || "processing").toLowerCase();
  if (paymentStatus === "failed") return "Cancelled";
  if (paymentStatus === "pending") return "Awaiting payment";
  if (orderStatus === "delivered") return "Delivered";
  if (orderStatus === "shipped") return "Shipped";
  if (orderStatus === "cancelled") return "Cancelled";
  return "Processing";
}

function getOrderStep(order) {
  const label = getOrderLabel(order);
  if (label === "Processing") return 1;
  if (label === "Shipped") return 3;
  if (label === "Delivered") return 4;
  return 0;
}

function AccountBadge({ tone = "neutral", children }) {
  return <span className={`customer-badge customer-badge-${tone}`}>{children}</span>;
}

function AccountShell({ currentUser, activeTab, setActiveTab, title, subtitle, actions, children, onLogout, membership }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const fullName = currentUser?.fullName || currentUser?.email || "Customer";
  const initial = String(fullName).trim().charAt(0).toUpperCase() || "I";
  const joinedYear = currentUser?.createdAt ? new Date(currentUser.createdAt).getFullYear() : new Date().getFullYear();

  return (
    <div className={`customer-dashboard ${mobileOpen ? "is-nav-open" : ""}`}>
      <aside className={`customer-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link to="/" className="customer-brand">
          <span>I</span>
          <strong>IfeShades<span>n</span>More</strong>
        </Link>
        <nav className="customer-nav" aria-label="Customer account sections">
          <p>Your account</p>
          {ACCOUNT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => {
                setActiveTab(tab.id);
                setMobileOpen(false);
              }}
            >
              <AccountIcon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="customer-member-card">
          <p>{membership?.label || "New member"}</p>
          <span>{membership?.description || "Place your first paid order to start earning Gold status."}</span>
          <Link to="/"><AccountIcon name="shop" /> Continue shopping</Link>
        </div>
        <div className="customer-owner-card">
          <i>{initial}</i>
          <div>
            <strong>{fullName}</strong>
            <span>Member since {joinedYear}</span>
          </div>
          <button type="button" onClick={onLogout} aria-label="Logout"><AccountIcon name="logout" /></button>
        </div>
      </aside>

      {mobileOpen ? <button type="button" className="customer-nav-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} /> : null}

      <div className="customer-main">
        <header className="customer-topbar">
          <button type="button" className="customer-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <AccountIcon name="grid" />
          </button>
          <Link to="/" className="customer-back-link">Back to store</Link>
          <button type="button" className="customer-bell" aria-label="Notifications">
            <AccountIcon name="bell" />
            <i />
          </button>
        </header>
        <main className="customer-content">
          <div className="customer-page-heading">
            <div>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions ? <div className="customer-page-actions">{actions}</div> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function AccountPage({ currentUser, onLoggedOut, onUserUpdated, products = [] }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileSection, setProfileSection] = useState("personal");
  const [orderFilter, setOrderFilter] = useState("All");
  const [addressDrawer, setAddressDrawer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [membership, setMembership] = useState({
    tier: "new",
    label: "New member",
    description: "Place your first paid order to start earning Gold status.",
    paidOrderCount: 0,
    totalSpent: 0
  });
  const [profileDraft, setProfileDraft] = useState({
    fullName: currentUser?.fullName || "",
    phone: currentUser?.phone || "",
    address: currentUser?.address || "",
    city: currentUser?.city || "",
    frameSize: "Medium",
    prescription: "",
    frameStyles: [],
    lensPreferences: [],
    notifications: {
      orders: true,
      restocks: true,
      drops: true,
      offers: false,
      email: true,
      sms: false
    }
  });
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    setProfileDraft((current) => ({
      ...current,
      fullName: currentUser?.fullName || "",
      phone: currentUser?.phone || "",
      address: currentUser?.address || "",
      city: currentUser?.city || ""
    }));
  }, [currentUser]);

  useEffect(() => {
    fetchAccountDashboard()
      .then((payload) => {
        setOrders(Array.isArray(payload.orders) ? payload.orders : []);
        setAddresses(Array.isArray(payload.addresses) ? payload.addresses : []);
        setWishlistProducts(Array.isArray(payload.wishlist) ? payload.wishlist : []);
        setMembership(payload.membership || membership);
        setProfileDraft((current) => ({
          ...current,
          frameSize: payload.preferences?.frameSize || current.frameSize,
          prescription: payload.preferences?.prescription || "",
          frameStyles: Array.isArray(payload.preferences?.frameStyles) ? payload.preferences.frameStyles : [],
          lensPreferences: Array.isArray(payload.preferences?.lensPreferences) ? payload.preferences.lensPreferences : [],
          notifications: {
            ...current.notifications,
            ...(payload.notifications || {})
          }
        }));
      })
      .catch((requestError) => setOrdersError(requestError.message || "Could not fetch account dashboard."));
  }, []);

  const firstName = String(currentUser?.fullName || "").trim().split(/\s+/)[0] || "there";
  const paidOrders = useMemo(() => orders.filter((order) => String(order.paymentStatus || "").toLowerCase() === "paid"), [orders]);
  const deliveredOrders = useMemo(() => orders.filter((order) => String(order.orderStatus || "").toLowerCase() === "delivered"), [orders]);
  const activeOrders = useMemo(() => orders.filter((order) => ["Processing", "Shipped", "Awaiting payment"].includes(getOrderLabel(order))), [orders]);
  const latestOrder = orders[0] || null;
  const recommendedProducts = useMemo(
    () => products.filter((product) => normalizeAvailability(product.availability) !== "out_of_stock").slice(0, 4),
    [products]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const label = getOrderLabel(order);
      if (orderFilter === "All") return true;
      if (orderFilter === "Active") return label !== "Delivered" && label !== "Cancelled";
      if (orderFilter === "Delivered") return label === "Delivered";
      return label === "Cancelled";
    });
  }, [orderFilter, orders]);

  const signOut = async () => {
    await logout().catch(() => {});
    onLoggedOut();
    navigate({ to: "/", replace: true });
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setNotice("");
    setProfileError("");
    setIsSaving(true);
    try {
      const payload = await updateProfile({
        fullName: profileDraft.fullName,
        phone: profileDraft.phone,
        address: profileDraft.address,
        city: profileDraft.city
      });
      onUserUpdated(payload.user);
      setNotice("Profile updated.");
    } catch (requestError) {
      setProfileError(requestError.message || "Could not update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setNotice("");
    setPasswordError("");
    if (!passwordDraft.currentPassword || !passwordDraft.newPassword) {
      setPasswordError("Current and new password are required.");
      return;
    }
    if (passwordDraft.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    setIsChangingPassword(true);
    try {
      const payload = await updatePassword({
        currentPassword: passwordDraft.currentPassword,
        newPassword: passwordDraft.newPassword
      });
      setNotice(payload?.message || "Password updated successfully.");
      setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (requestError) {
      setPasswordError(requestError.message || "Could not update password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const addRecommendedWishlistProduct = async (productId) => {
    setAccountError("");
    try {
      const payload = await addWishlistItem(productId);
      setWishlistProducts(Array.isArray(payload.wishlist) ? payload.wishlist : []);
      setNotice("Wishlist updated.");
    } catch (requestError) {
      setAccountError(requestError.message || "Could not update wishlist.");
    }
  };

  const removeWishlistProduct = async (productId) => {
    setAccountError("");
    try {
      const payload = await removeWishlistItem(productId);
      setWishlistProducts(Array.isArray(payload.wishlist) ? payload.wishlist : []);
      setNotice("Wishlist updated.");
    } catch (requestError) {
      setAccountError(requestError.message || "Could not update wishlist.");
    }
  };

  const saveAddress = async (address) => {
    setAccountError("");
    try {
      const payload = address.id
        ? await updateAccountAddress(address.id, address)
        : await createAccountAddress(address);
      setAddresses(Array.isArray(payload.addresses) ? payload.addresses : []);
      setAddressDrawer(null);
      setNotice("Address saved.");
    } catch (requestError) {
      setAccountError(requestError.message || "Could not save address.");
    }
  };

  const removeAddress = async (addressId) => {
    setAccountError("");
    try {
      const payload = await deleteAccountAddress(addressId);
      setAddresses(Array.isArray(payload.addresses) ? payload.addresses : []);
      setNotice("Address removed.");
    } catch (requestError) {
      setAccountError(requestError.message || "Could not remove address.");
    }
  };

  const markDefaultAddress = async (addressId) => {
    setAccountError("");
    try {
      const payload = await setDefaultAccountAddress(addressId);
      setAddresses(Array.isArray(payload.addresses) ? payload.addresses : []);
      setNotice("Default address updated.");
    } catch (requestError) {
      setAccountError(requestError.message || "Could not update address.");
    }
  };

  const saveAccountPreferences = async () => {
    setAccountError("");
    setNotice("");
    try {
      const payload = await updateAccountPreferences({
        frameSize: profileDraft.frameSize,
        prescription: profileDraft.prescription,
        frameStyles: profileDraft.frameStyles,
        lensPreferences: profileDraft.lensPreferences,
        notifications: profileDraft.notifications
      });
      setProfileDraft((current) => ({
        ...current,
        ...(payload.preferences || {}),
        notifications: {
          ...current.notifications,
          ...(payload.notifications || {})
        }
      }));
      setNotice("Preferences saved.");
    } catch (requestError) {
      setAccountError(requestError.message || "Could not save preferences.");
    }
  };

  const pageTitle = activeTab === "overview" ? `Hi, ${firstName}` : ACCOUNT_TABS.find((tab) => tab.id === activeTab)?.label || "Account";
  const pageSubtitle = {
    overview: "Track orders, manage frames, and keep your style consistent.",
    orders: "Every purchase and receipt in one place.",
    wishlist: "Frames you love, saved for the right moment.",
    addresses: "Save the places you call home. Faster checkout, every time.",
    profile: "Keep your info fresh so we can serve you better."
  }[activeTab];

  const actions = activeTab === "overview" ? (
    <Link to="/" className="customer-primary-button">Continue shopping</Link>
  ) : activeTab === "addresses" ? (
    <button type="button" className="customer-primary-button" onClick={() => setAddressDrawer({})}><AccountIcon name="plus" /> Add address</button>
  ) : null;

  return (
    <AccountShell
      currentUser={currentUser}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      title={pageTitle}
      subtitle={pageSubtitle}
      actions={actions}
      onLogout={signOut}
      membership={membership}
    >
      {notice ? <p className="customer-toast-note">{notice}</p> : null}
      {ordersError ? <p className="customer-error-note">{ordersError}</p> : null}
      {accountError ? <p className="customer-error-note">{accountError}</p> : null}

      {activeTab === "overview" ? (
        <OverviewSection
          activeOrders={activeOrders}
          deliveredOrders={deliveredOrders}
          paidOrders={paidOrders}
          latestOrder={latestOrder}
          orders={orders}
          wishlistCount={wishlistProducts.length}
          membership={membership}
          setActiveTab={setActiveTab}
        />
      ) : null}

      {activeTab === "orders" ? (
        <OrdersSection
          orders={orders}
          filteredOrders={filteredOrders}
          orderFilter={orderFilter}
          setOrderFilter={setOrderFilter}
        />
      ) : null}

      {activeTab === "wishlist" ? (
        <WishlistSection
          products={wishlistProducts}
          recommendedProducts={recommendedProducts}
          onAdd={addRecommendedWishlistProduct}
          onRemove={removeWishlistProduct}
        />
      ) : null}

      {activeTab === "addresses" ? (
        <AddressesSection
          addresses={addresses}
          onSetDefault={markDefaultAddress}
          onRemove={removeAddress}
          onEdit={(address) => setAddressDrawer(address)}
          onAdd={() => setAddressDrawer({})}
        />
      ) : null}

      {activeTab === "profile" ? (
        <ProfileSection
          currentUser={currentUser}
          profileDraft={profileDraft}
          setProfileDraft={setProfileDraft}
          passwordDraft={passwordDraft}
          setPasswordDraft={setPasswordDraft}
          profileSection={profileSection}
          setProfileSection={setProfileSection}
          profileError={profileError}
          passwordError={passwordError}
          isSaving={isSaving}
          isChangingPassword={isChangingPassword}
          onSaveProfile={saveProfile}
          onSavePreferences={saveAccountPreferences}
          onChangePassword={changePassword}
        />
      ) : null}

      {addressDrawer ? (
        <AddressDrawer
          address={addressDrawer.id ? addressDrawer : null}
          currentUser={currentUser}
          onClose={() => setAddressDrawer(null)}
          onSave={saveAddress}
        />
      ) : null}
    </AccountShell>
  );
}

function OverviewSection({ activeOrders, deliveredOrders, paidOrders, latestOrder, orders, wishlistCount, membership, setActiveTab }) {
  return (
    <>
      <div className="customer-stats-grid">
        <CustomerStat icon="box" label="Active orders" value={String(activeOrders.length)} hint={activeOrders[0] ? getOrderLabel(activeOrders[0]) : "No active order"} />
        <CustomerStat icon="shop" label="Delivered" value={String(deliveredOrders.length)} hint="All-time" />
        <CustomerStat icon="heart" label="Wishlist" value={String(wishlistCount)} hint="Saved frames" />
        <CustomerStat icon="user" label="Total spent" value={toPrice(paidOrders.reduce((sum, order) => sum + getOrderTotal(order), 0))} hint="Paid orders" />
      </div>

      <section className={`customer-membership-card is-${membership.tier || "new"}`}>
        <div>
          <p>Membership</p>
          <h2>{membership.label}</h2>
          <span>{membership.description}</span>
        </div>
        <strong>{membership.paidOrderCount || 0} paid order{Number(membership.paidOrderCount || 0) === 1 ? "" : "s"}</strong>
      </section>

      <section className="customer-tracking-card">
        <div>
          <p>Tracking</p>
          <h2>{latestOrder ? `${latestOrder.items?.[0]?.name || "Your order"} ${getOrderLabel(latestOrder).toLowerCase()}` : "No active order yet"}</h2>
          <span>{latestOrder ? `${latestOrder.id} - ${formatDate(latestOrder.createdAt)}` : "When you place an order, tracking appears here."}</span>
        </div>
        <button type="button" onClick={() => setActiveTab("orders")}>Track order</button>
        <OrderProgress order={latestOrder} />
      </section>

      <section className="customer-panel">
        <header>
          <h2>Recent orders</h2>
          <button type="button" onClick={() => setActiveTab("orders")}>View all</button>
        </header>
        <div className="customer-recent-list">
          {orders.slice(0, 3).map((order) => <RecentOrderRow key={order.id} order={order} />)}
          {orders.length === 0 ? <p className="customer-empty">No orders yet.</p> : null}
        </div>
      </section>

      <div className="customer-quick-grid">
        <QuickLink icon="pin" title="Manage addresses" subtitle="Home, work and beyond" onClick={() => setActiveTab("addresses")} />
        <QuickLink icon="heart" title="Your wishlist" subtitle={`${wishlistCount} frames saved`} onClick={() => setActiveTab("wishlist")} />
        <QuickLink icon="user" title="Profile & preferences" subtitle="Frame size, lens specs" onClick={() => setActiveTab("profile")} />
      </div>
    </>
  );
}

function CustomerStat({ icon, label, value, hint }) {
  return (
    <article className="customer-stat-card">
      <AccountIcon name={icon} />
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

function RecentOrderRow({ order }) {
  const label = getOrderLabel(order);
  return (
    <article className="customer-recent-row">
      <i><AccountIcon name="box" /></i>
      <div>
        <strong>{order.items?.[0]?.name || order.id}</strong>
        <span>{order.id} - {formatDate(order.createdAt)}</span>
      </div>
      <AccountBadge tone={label === "Delivered" ? "success" : label === "Cancelled" ? "danger" : "gold"}>{label}</AccountBadge>
      <em>{toPrice(getOrderTotal(order))}</em>
    </article>
  );
}

function OrdersSection({ orders, filteredOrders, orderFilter, setOrderFilter }) {
  const countFor = (tab) => {
    if (tab === "All") return orders.length;
    if (tab === "Active") return orders.filter((order) => {
      const label = getOrderLabel(order);
      return label !== "Delivered" && label !== "Cancelled";
    }).length;
    if (tab === "Delivered") return orders.filter((order) => getOrderLabel(order) === "Delivered").length;
    return orders.filter((order) => getOrderLabel(order) === "Cancelled").length;
  };

  return (
    <>
      <div className="customer-tabs">
        {ORDER_TABS.map((tab) => (
          <button key={tab} type="button" className={orderFilter === tab ? "is-active" : ""} onClick={() => setOrderFilter(tab)}>
            {tab}<span>{countFor(tab)}</span>
          </button>
        ))}
      </div>
      <div className="customer-order-list">
        {filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)}
        {filteredOrders.length === 0 ? <p className="customer-empty">No orders in this tab yet.</p> : null}
      </div>
    </>
  );
}

function OrderCard({ order }) {
  const label = getOrderLabel(order);
  const tone = label === "Delivered" ? "success" : label === "Cancelled" ? "danger" : label === "Awaiting payment" ? "warning" : "gold";
  const itemCount = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return (
    <article className="customer-order-card">
      <header>
        <div className="customer-order-title">
          <i><AccountIcon name="box" /></i>
          <div>
            <span>{order.id}</span>
            <h2>{(order.items || []).map((item) => item.name).join(", ") || "Order"}</h2>
            <p>{formatDateTime(order.createdAt)} - {itemCount} item{itemCount === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="customer-order-total">
          <AccountBadge tone={tone}>{label}</AccountBadge>
          <strong>{toPrice(getOrderTotal(order))}</strong>
        </div>
      </header>
      {label !== "Cancelled" && label !== "Delivered" ? <OrderProgress order={order} /> : null}
      <ul>
        {(order.items || []).map((item) => (
          <li key={`${order.id}-${item.id || item.productId}`}>
            <span>{item.name} x {item.quantity}</span>
            <em>{toPrice(item.lineTotal || (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))}</em>
            {normalizeAvailability(item.availability) === "preorder" ? <small>Preorder: {item.preorderNote || "Shipping timeline will be confirmed before dispatch."}</small> : null}
          </li>
        ))}
      </ul>
      <footer>
        <button type="button">View receipt</button>
        <button type="button">Contact support</button>
      </footer>
    </article>
  );
}

function OrderProgress({ order }) {
  const step = order ? getOrderStep(order) : 0;
  return (
    <div className="customer-progress">
      <div>
        {["Confirmed", "Packed", "Shipped", "Delivered"].map((label, index) => (
          <span key={label} className={step >= index + 1 ? "is-active" : ""}>{label}</span>
        ))}
      </div>
      <i><b style={{ width: `${Math.max(0, step / 4) * 100}%` }} /></i>
    </div>
  );
}

function WishlistSection({ products, recommendedProducts, onAdd, onRemove }) {
  if (products.length === 0) {
    return (
      <>
        <section className="customer-empty-state">
          <AccountIcon name="heart" />
          <h2>Your wishlist is empty</h2>
          <p>Save frames here and they will stay tied to your account.</p>
          <Link to="/" className="customer-primary-button">Browse frames</Link>
        </section>
        {recommendedProducts.length > 0 ? (
          <section className="customer-panel customer-recommendations">
            <header><h2>Recommended to save</h2></header>
            <div className="customer-wishlist-grid">
              {recommendedProducts.map((product) => (
                <article key={product.id} className="customer-wishlist-card">
                  <div><ProductMedia product={product} /></div>
                  <section>
                    <h2>{product.name}</h2>
                    <strong>{toPrice(product.price)}</strong>
                    <p>{product.description || "Save for later"}</p>
                    <button type="button" className="customer-secondary-button" onClick={() => onAdd(product.id)}><AccountIcon name="heart" /> Save frame</button>
                  </section>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <div className="customer-wishlist-grid">
      {products.map((product) => (
        <article key={product.id} className="customer-wishlist-card">
          <div>
            <ProductMedia product={product} />
            <button type="button" onClick={() => onRemove(product.id)} aria-label={`Remove ${product.name}`}>
              <AccountIcon name="trash" />
            </button>
            {normalizeAvailability(product.availability) === "preorder" ? <AccountBadge tone="warning">Preorder</AccountBadge> : null}
          </div>
          <section>
            <h2>{product.name}</h2>
            <strong>{toPrice(product.price)}</strong>
            <p>{product.description || "Saved for later"}</p>
            <Link to="/" className="customer-secondary-button"><AccountIcon name="shop" /> Add to cart</Link>
          </section>
        </article>
      ))}
    </div>
  );
}

function AddressesSection({ addresses, onSetDefault, onRemove, onEdit, onAdd }) {
  return (
    <div className="customer-address-grid">
      {addresses.map((address) => (
        <article key={address.id} className={`customer-address-card ${address.isDefault ? "is-default" : ""}`}>
          <header>
            <div>
              <i><AccountIcon name={address.label === "Work" ? "box" : "pin"} /></i>
              <span>{address.label || "Address"}</span>
              {address.isDefault ? <AccountBadge tone="gold">Default</AccountBadge> : null}
            </div>
            <div>
              <button type="button" onClick={() => onEdit(address)} aria-label="Edit address"><AccountIcon name="edit" /></button>
              <button type="button" onClick={() => onRemove(address.id)} aria-label="Delete address"><AccountIcon name="trash" /></button>
            </div>
          </header>
          <p><strong>{address.name || "Customer"}</strong></p>
          <p>{address.street || "No street address added"}</p>
          <p>{[address.city, address.state].filter(Boolean).join(", ") || "No city added"}</p>
          <p>{address.phone || "No phone added"}</p>
          {!address.isDefault ? <button type="button" onClick={() => onSetDefault(address.id)}>Set as default</button> : null}
        </article>
      ))}
      <button type="button" className="customer-add-address" onClick={onAdd}>
        <AccountIcon name="plus" />
        <span>Add a new address</span>
        <small>Home, work, anywhere</small>
      </button>
    </div>
  );
}

function ProfileSection(props) {
  const sections = [
    { id: "personal", label: "Personal info", icon: "user" },
    { id: "preferences", label: "Frame preferences", icon: "heart" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "security", label: "Security", icon: "box" }
  ];
  return (
    <div className="customer-profile-layout">
      <nav>
        {sections.map((section) => (
          <button key={section.id} type="button" className={props.profileSection === section.id ? "is-active" : ""} onClick={() => props.setProfileSection(section.id)}>
            <AccountIcon name={section.icon} />{section.label}
          </button>
        ))}
      </nav>
      <div>
        {props.profileSection === "personal" ? <PersonalProfile {...props} /> : null}
        {props.profileSection === "preferences" ? <PreferenceProfile {...props} /> : null}
        {props.profileSection === "notifications" ? <NotificationProfile {...props} /> : null}
        {props.profileSection === "security" ? <SecurityProfile {...props} /> : null}
      </div>
    </div>
  );
}

function ProfileCard({ title, subtitle, children }) {
  return <section className="customer-profile-card"><h2>{title}</h2><p>{subtitle}</p>{children}</section>;
}

function Field({ label, children, hint }) {
  return <label className="customer-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function PersonalProfile({ currentUser, profileDraft, setProfileDraft, profileError, isSaving, onSaveProfile }) {
  const initial = String(profileDraft.fullName || currentUser?.email || "I").trim().charAt(0).toUpperCase() || "I";
  return (
    <form onSubmit={onSaveProfile}>
      <ProfileCard title="Personal info" subtitle="Your name and contact details.">
        <div className="customer-photo-row">
          <i>{initial}</i>
          <div><strong>Profile photo</strong><span>PNG or JPG. Square recommended.</span></div>
          <button type="button">Upload</button>
        </div>
        <Field label="Full name"><input value={profileDraft.fullName} onChange={(event) => setProfileDraft((current) => ({ ...current, fullName: event.target.value }))} required /></Field>
        <Field label="Email"><input value={currentUser?.email || ""} readOnly /></Field>
        <Field label="Phone"><input value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} required /></Field>
        <div className="customer-form-grid">
          <Field label="Address"><input value={profileDraft.address} onChange={(event) => setProfileDraft((current) => ({ ...current, address: event.target.value }))} required /></Field>
          <Field label="City"><input value={profileDraft.city} onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))} required /></Field>
        </div>
        {profileError ? <p className="customer-error-note">{profileError}</p> : null}
        <footer><button type="submit" className="customer-primary-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save changes"}</button></footer>
      </ProfileCard>
    </form>
  );
}

function PreferenceProfile({ profileDraft, setProfileDraft, onSavePreferences }) {
  const toggleArrayValue = (field, value) => {
    setProfileDraft((current) => {
      const values = Array.isArray(current[field]) ? current[field] : [];
      const next = values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
      return { ...current, [field]: next };
    });
  };
  return (
    <ProfileCard title="Frame preferences" subtitle="Helps us recommend frames that fit and flatter.">
      <Field label="Preferred frame style">
        <div className="customer-choice-list">
          {["Round", "Square", "Cat-eye", "Aviator", "Browline", "Oversized"].map((style) => (
            <button key={style} type="button" className={profileDraft.frameStyles.includes(style) ? "is-active" : ""} onClick={() => toggleArrayValue("frameStyles", style)}>{style}</button>
          ))}
        </div>
      </Field>
      <Field label="Frame size">
        <div className="customer-segmented">
          {["Small", "Medium", "Large"].map((size) => (
            <button key={size} type="button" className={profileDraft.frameSize === size ? "is-active" : ""} onClick={() => setProfileDraft((current) => ({ ...current, frameSize: size }))}>{size}</button>
          ))}
        </div>
      </Field>
      <Field label="Prescription on file" hint="We will match your script when you order prescription lenses.">
        <textarea rows={4} value={profileDraft.prescription} onChange={(event) => setProfileDraft((current) => ({ ...current, prescription: event.target.value }))} placeholder="OD: -2.25 / OS: -2.00 - PD: 62mm" />
      </Field>
      <Field label="Lens preference">
        <div className="customer-checkbox-grid">
          {["Anti-blue light", "Polarized", "Photochromic", "Standard clear"].map((lens) => (
            <label key={lens}><input type="checkbox" checked={profileDraft.lensPreferences.includes(lens)} onChange={() => toggleArrayValue("lensPreferences", lens)} />{lens}</label>
          ))}
        </div>
      </Field>
      <footer><button type="button" className="customer-primary-button" onClick={onSavePreferences}>Save preferences</button></footer>
    </ProfileCard>
  );
}

function NotificationProfile({ profileDraft, setProfileDraft, onSavePreferences }) {
  const toggles = [
    ["orders", "Order updates", "Confirmation, packing, shipping and delivery alerts."],
    ["restocks", "Restock alerts", "Tell me when wishlist items are back in stock."],
    ["drops", "New drops", "Be the first to see new collections."],
    ["offers", "Promotions & offers", "Exclusive member deals."],
    ["email", "Email notifications", "Use email for account and campaign messages."],
    ["sms", "SMS notifications", "Receive important alerts via text."]
  ];
  return (
    <ProfileCard title="Notifications" subtitle="Choose what we send and when.">
      {toggles.map(([key, label, description]) => (
        <div key={key} className="customer-toggle-row">
          <div><strong>{label}</strong><span>{description}</span></div>
          <button type="button" className={profileDraft.notifications[key] ? "is-on" : ""} onClick={() => setProfileDraft((current) => ({ ...current, notifications: { ...current.notifications, [key]: !current.notifications[key] } }))}><i /></button>
        </div>
      ))}
      <footer><button type="button" className="customer-primary-button" onClick={onSavePreferences}>Save notifications</button></footer>
    </ProfileCard>
  );
}

function SecurityProfile({ passwordDraft, setPasswordDraft, passwordError, isChangingPassword, onChangePassword }) {
  return (
    <form onSubmit={onChangePassword}>
      <ProfileCard title="Security" subtitle="Keep your account locked down.">
        <Field label="Current password"><input type="password" value={passwordDraft.currentPassword} onChange={(event) => setPasswordDraft((current) => ({ ...current, currentPassword: event.target.value }))} /></Field>
        <Field label="New password"><input type="password" value={passwordDraft.newPassword} onChange={(event) => setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))} minLength={8} /></Field>
        <Field label="Confirm new password"><input type="password" value={passwordDraft.confirmPassword} onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={8} /></Field>
        <div className="customer-toggle-row">
          <div><strong>Two-factor authentication</strong><span>Extra protection when signing in.</span></div>
          <button type="button"><i /></button>
        </div>
        {passwordError ? <p className="customer-error-note">{passwordError}</p> : null}
        <footer><button type="submit" className="customer-primary-button" disabled={isChangingPassword}>{isChangingPassword ? "Updating..." : "Update password"}</button></footer>
      </ProfileCard>
    </form>
  );
}

function AddressDrawer({ address, currentUser, onClose, onSave }) {
  const [form, setForm] = useState(address || {
    id: "",
    label: "Home",
    name: currentUser?.fullName || "",
    street: "",
    city: currentUser?.city || "",
    state: "",
    phone: currentUser?.phone || "",
    isDefault: false
  });
  return (
    <div className="customer-drawer">
      <button type="button" className="customer-drawer-backdrop" onClick={onClose} aria-label="Close address drawer" />
      <section>
        <header>
          <div><p>{address ? "Edit" : "New"}</p><h2>{address ? "Edit address" : "Add address"}</h2></div>
          <button type="button" onClick={onClose}>x</button>
        </header>
        <div>
          <Field label="Label">
            <div className="customer-segmented">
              {["Home", "Work", "Other"].map((label) => <button key={label} type="button" className={form.label === label ? "is-active" : ""} onClick={() => setForm((current) => ({ ...current, label }))}>{label}</button>)}
            </div>
          </Field>
          <Field label="Full name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Street address"><input value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} /></Field>
          <div className="customer-form-grid">
            <Field label="City"><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></Field>
            <Field label="State"><input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} /></Field>
          </div>
          <Field label="Phone"><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></Field>
          <label className="customer-check-row"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />Set as default delivery address</label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="customer-primary-button" onClick={() => onSave(form)}>{address ? "Save changes" : "Add address"}</button>
        </footer>
      </section>
    </div>
  );
}

function QuickLink({ icon, title, subtitle, onClick }) {
  return (
    <button type="button" className="customer-quick-link" onClick={onClick}>
      <i><AccountIcon name={icon} /></i>
      <span><strong>{title}</strong><small>{subtitle}</small></span>
      <b>Open</b>
    </button>
  );
}

export default AccountPage;
