import { useEffect, useMemo, useState } from "react";
import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";
import { getStoredThemeVariant, persistThemeVariant } from "../../utils/themePreference";
import {
  AUDIENCE_OPTIONS,
  BULLET_ICON_TYPES,
  DEFAULT_SETTINGS,
  PRODUCT_AVAILABILITY_OPTIONS
} from "../../constants/storefront";
import {
  createAdminCustomer,
  createAdminOrder,
  deleteAdminCustomer,
  createBlog,
  createSubscription,
  deleteBlog,
  fetchAdminBlogs,
  fetchAdminCustomers,
  fetchAllOrders,
  fetchSubscriptions,
  updateBlog,
  updateOrderStatus,
  uploadImage
} from "../../utils/api";

const ADMIN_TABS = [
  { id: "orders", label: "Orders", icon: "orders" },
  { id: "customers", label: "Customers", icon: "customers" },
  { id: "subscribers", label: "Subscribers", icon: "subscribers" },
  { id: "blogs", label: "Blogs", icon: "blogs" },
  { id: "products", label: "Products", icon: "products" },
  { id: "settings", label: "Settings", icon: "settings" }
];

const ADMIN_THEME_OPTIONS = [
  { id: "v1", label: "Gallery" },
  { id: "v2", label: "Terra" },
  { id: "v3", label: "Solar" }
];

const ORDER_STATUS_OPTIONS = ["pending", "processing", "shipped", "delivered", "cancelled"];
const ORDER_FILTERS = [
  { id: "orders", label: "Orders" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" }
];
const EMPTY_BLOG_DRAFT = {
  id: "",
  title: "",
  excerpt: "",
  content: "",
  image: "",
  author: "IfeShadesnMore",
  isPublished: true
};
const EMPTY_CUSTOMER_DRAFT = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: ""
};
const EMPTY_SUBSCRIBER_DRAFT = {
  email: "",
  source: "admin"
};
const EMPTY_ORDER_DRAFT = {
  customerId: "",
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  paymentMethod: "transfer",
  paymentStatus: "pending",
  orderStatus: "pending",
  items: [{ productId: "", quantity: 1 }]
};

function AdminIcon({ name }) {
  const sharedProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false"
  };

  if (name === "orders") {
    return (
      <svg {...sharedProps}>
        <path d="M7 3h10l2 3v15H5V6l2-3Z" />
        <path d="M8 9h8" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    );
  }

  if (name === "customers") {
    return (
      <svg {...sharedProps}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M20.5 21v-2a3.5 3.5 0 0 0-2.6-3.4" />
        <path d="M17 3.4a4 4 0 0 1 0 7.2" />
      </svg>
    );
  }

  if (name === "subscribers") {
    return (
      <svg {...sharedProps}>
        <path d="M4 6h16v12H4V6Z" />
        <path d="m4 8 8 5 8-5" />
      </svg>
    );
  }

  if (name === "blogs") {
    return (
      <svg {...sharedProps}>
        <path d="M6 4h12v16H6V4Z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
    );
  }

  if (name === "products") {
    return (
      <svg {...sharedProps}>
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...sharedProps}>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-1.8 3.12-.08-.02a1.8 1.8 0 0 0-2.1.76l-.04.08h-3.6l-.04-.08a1.8 1.8 0 0 0-2.1-.76l-.08.02-1.8-3.12.06-.06A1.8 1.8 0 0 0 4.6 15l-.08-.02v-3.6l.08-.02a1.8 1.8 0 0 0 1.64-1.98l-.06-.06 1.8-3.12.08.02a1.8 1.8 0 0 0 2.1-.76l.04-.08h3.6l.04.08a1.8 1.8 0 0 0 2.1.76l.08-.02 1.8 3.12-.06.06a1.8 1.8 0 0 0 1.64 1.98l.08.02v3.6l-.08.02Z" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...sharedProps}>
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
        <path d="m20 20-4.2-4.2" />
      </svg>
    );
  }

  if (name === "theme") {
    return (
      <svg {...sharedProps}>
        <path d="M12 3a9 9 0 1 0 9 9c0-.6-.49-1-1.09-1h-1.56a2.1 2.1 0 0 1-2.1-2.1V7.34A4.34 4.34 0 0 0 11.91 3H12Z" />
        <path d="M7.5 11.5h.01" />
        <path d="M9.5 7.8h.01" />
        <path d="M13.8 6.8h.01" />
      </svg>
    );
  }

  if (name === "menu") {
    return (
      <svg {...sharedProps}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg {...sharedProps}>
        <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg {...sharedProps}>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  if (name === "chevron") {
    return (
      <svg {...sharedProps}>
        <path d="m7 10 5 5 5-5" />
      </svg>
    );
  }

  if (name === "storefront") {
    return (
      <svg {...sharedProps}>
        <path d="M4 10h16l-1-5H5l-1 5Z" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
        <path d="M4 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      </svg>
    );
  }

  return null;
}

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

function formatAvailabilityLabel(value) {
  const option = PRODUCT_AVAILABILITY_OPTIONS.find((entry) => entry.value === value);
  return option ? option.label : "In Stock";
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
  onBlogsChange,
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
  const [blogs, setBlogs] = useState([]);
  const [blogDraft, setBlogDraft] = useState(EMPTY_BLOG_DRAFT);
  const [customerDraft, setCustomerDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [subscriberDraft, setSubscriberDraft] = useState(EMPTY_SUBSCRIBER_DRAFT);
  const [orderDraft, setOrderDraft] = useState(EMPTY_ORDER_DRAFT);
  const [isEditingBlog, setIsEditingBlog] = useState(false);
  const [blogMessage, setBlogMessage] = useState("");
  const [isBlogImageUploading, setIsBlogImageUploading] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [orderStatusDrafts, setOrderStatusDrafts] = useState({});
  const [orderFilter, setOrderFilter] = useState("orders");
  const [orderStatusNotice, setOrderStatusNotice] = useState("");
  const [orderStatusError, setOrderStatusError] = useState("");
  const [customerActionNotice, setCustomerActionNotice] = useState("");
  const [customerActionError, setCustomerActionError] = useState("");
  const [adminTheme, setAdminTheme] = useState(() => getStoredThemeVariant());
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const selectedAudiences = useMemo(
    () => normalizeAudienceSelections(productDraft.audiences),
    [productDraft.audiences]
  );
  const activeTabMeta = ADMIN_TABS.find((tab) => tab.id === activeTab) || ADMIN_TABS[0];
  const activeThemeMeta = ADMIN_THEME_OPTIONS.find((themeOption) => themeOption.id === adminTheme) || ADMIN_THEME_OPTIONS[0];
  const adminName = currentUser?.fullName || currentUser?.email || "Owner";
  const adminInitial = String(adminName || "I").trim().charAt(0).toUpperCase() || "I";

  useEffect(() => {
    persistThemeVariant(adminTheme);
  }, [adminTheme]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoadingData(true);
      setDataError("");
      try {
        const [ordersPayload, customersPayload, subscriptionsPayload, blogsPayload] = await Promise.all([
          fetchAllOrders(),
          fetchAdminCustomers(),
          fetchSubscriptions(),
          fetchAdminBlogs()
        ]);

        if (!isMounted) return;

        const nextOrders = Array.isArray(ordersPayload?.orders) ? ordersPayload.orders : [];
        setOrders(nextOrders);
        setCustomers(Array.isArray(customersPayload?.customers) ? customersPayload.customers : []);
        setSubscriptions(
          Array.isArray(subscriptionsPayload?.subscriptions) ? subscriptionsPayload.subscriptions : []
        );
        const nextBlogs = Array.isArray(blogsPayload?.blogs) ? blogsPayload.blogs : [];
        setBlogs(nextBlogs);
        onBlogsChange?.(nextBlogs.filter((blog) => blog.isPublished));

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

  const paidOrders = useMemo(
    () => orders.filter((order) => order.paymentStatus === "paid"),
    [orders]
  );

  const pendingOrders = useMemo(
    () =>
      orders.filter((order) =>
        order.paymentStatus === "pending" || String(order.orderStatus || "pending") === "pending"
      ).length,
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (orderFilter === "orders") return orders.filter((order) => order.paymentStatus === "paid");
    if (orderFilter === "failed") return orders.filter((order) => order.paymentStatus === "failed");
    return orders.filter(
      (order) => order.paymentStatus === "pending" || String(order.orderStatus || "pending") === "pending"
    );
  }, [orderFilter, orders]);

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

  const syncBlogs = (nextBlogs) => {
    setBlogs(nextBlogs);
    onBlogsChange?.(nextBlogs.filter((blog) => blog.isPublished));
  };

  const resetBlogDraft = () => {
    setBlogDraft(EMPTY_BLOG_DRAFT);
    setIsEditingBlog(false);
  };

  const resetModalFeedback = () => {
    setModalMessage("");
    setModalError("");
  };

  const getPageAction = () => {
    if (activeTab === "orders") return { label: "Create Order", modal: "order" };
    if (activeTab === "customers") return { label: "Create Customer", modal: "customer" };
    if (activeTab === "subscribers") return { label: "Add Subscriber", modal: "subscriber" };
    if (activeTab === "blogs") return { label: "Write Blog", modal: "blog" };
    if (activeTab === "products") return { label: "Add Product", modal: "product" };
    if (activeTab === "settings") return { label: "Edit Settings", modal: "settings" };
    return null;
  };

  const openModal = (modalName) => {
    resetModalFeedback();
    setActiveModal(modalName);
  };

  const handlePageAction = () => {
    const action = getPageAction();
    if (!action) return;
    if (action.modal === "product") {
      openAddProductModal();
      return;
    }
    if (action.modal === "blog") {
      openAddBlogModal();
      return;
    }
    openModal(action.modal);
  };

  const setOrderDraftField = (field, value) => {
    setOrderDraft((current) => ({ ...current, [field]: value }));
  };

  const setOrderDraftItem = (index, field, value) => {
    setOrderDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addOrderDraftItem = () => {
    setOrderDraft((current) => ({
      ...current,
      items: [...current.items, { productId: "", quantity: 1 }]
    }));
  };

  const removeOrderDraftItem = (index) => {
    setOrderDraft((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((_, itemIndex) => itemIndex !== index) : current.items
    }));
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    resetModalFeedback();
    try {
      const payload = {
        ...orderDraft,
        customerId: orderDraft.customerId ? Number(orderDraft.customerId) : undefined,
        items: orderDraft.items
          .filter((item) => item.productId)
          .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) || 1 }))
      };
      const result = await createAdminOrder(payload);
      if (!result?.order) throw new Error("Could not create order.");
      setOrders((current) => [result.order, ...current]);
      setOrderStatusDrafts((current) => ({ ...current, [result.order.id]: result.order.orderStatus || "pending" }));
      setOrderDraft(EMPTY_ORDER_DRAFT);
      setActiveModal(null);
      setOrderStatusNotice(`Order ${result.order.id} created.`);
    } catch (requestError) {
      setModalError(requestError.message || "Could not create order.");
    }
  };

  const handleCreateCustomer = async (event) => {
    event.preventDefault();
    resetModalFeedback();
    try {
      const result = await createAdminCustomer(customerDraft);
      if (!result?.customer) throw new Error("Could not create customer.");
      setCustomers((current) => [result.customer, ...current]);
      setCustomerDraft(EMPTY_CUSTOMER_DRAFT);
      setActiveModal(null);
      setCustomerActionNotice(`Customer "${result.customer.fullName || result.customer.email}" created.`);
    } catch (requestError) {
      setModalError(requestError.message || "Could not create customer.");
    }
  };

  const handleCreateSubscriber = async (event) => {
    event.preventDefault();
    resetModalFeedback();
    try {
      const result = await createSubscription(subscriberDraft);
      const now = new Date().toISOString();
      setSubscriptions((current) => [
        {
          id: result?.id || `new-${Date.now()}`,
          email: subscriberDraft.email,
          source: subscriberDraft.source || "admin",
          createdAt: now
        },
        ...current.filter((subscription) => subscription.email !== subscriberDraft.email)
      ]);
      setSubscriberDraft(EMPTY_SUBSCRIBER_DRAFT);
      setActiveModal(null);
      setModalMessage("Subscriber added.");
    } catch (requestError) {
      setModalError(requestError.message || "Could not add subscriber.");
    }
  };

  const openAddProductModal = () => {
    onCancelEdit?.();
    setActiveTab("products");
    openModal("product");
  };

  const openEditProductModal = (product) => {
    onStartEdit(product);
    setActiveTab("products");
    openModal("product");
  };

  const closeProductModal = () => {
    onCancelEdit?.();
    setActiveModal(null);
  };

  const handleProductModalSubmit = async (event) => {
    await onProductSubmit(event);
    setActiveModal(null);
  };

  const startEditBlog = (blog) => {
    setBlogDraft({
      id: blog.id,
      title: blog.title || "",
      excerpt: blog.excerpt || "",
      content: blog.content || "",
      image: blog.image || "",
      author: blog.author || "IfeShadesnMore",
      isPublished: Boolean(blog.isPublished)
    });
    setIsEditingBlog(true);
    setBlogMessage("");
    setActiveTab("blogs");
    setActiveModal("blog");
  };

  const openAddBlogModal = () => {
    resetBlogDraft();
    setActiveTab("blogs");
    openModal("blog");
  };

  const handleBlogSubmit = async (event) => {
    event.preventDefault();
    setBlogMessage("");
    try {
      const payload = {
        title: blogDraft.title.trim(),
        excerpt: blogDraft.excerpt.trim(),
        content: blogDraft.content.trim(),
        image: blogDraft.image.trim(),
        author: blogDraft.author.trim(),
        isPublished: Boolean(blogDraft.isPublished)
      };
      if (!payload.title) throw new Error("Blog title is required.");
      if (!payload.content) throw new Error("Blog content is required.");
      const response = isEditingBlog
        ? await updateBlog(blogDraft.id, payload)
        : await createBlog(payload);
      const savedBlog = response.blog;
      const nextBlogs = isEditingBlog
        ? blogs.map((blog) => (blog.id === savedBlog.id ? savedBlog : blog))
        : [savedBlog, ...blogs];
      syncBlogs(nextBlogs);
      setBlogMessage(isEditingBlog ? "Blog post updated." : "Blog post published.");
      resetBlogDraft();
      setActiveModal(null);
    } catch (requestError) {
      setBlogMessage(requestError.message || "Could not save blog post.");
    }
  };

  const handleBlogImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBlogMessage("");
    setIsBlogImageUploading(true);
    try {
      const result = await uploadImage(file, "blog");
      setBlogDraft((current) => ({ ...current, image: result.secureUrl || "" }));
      setBlogMessage("Blog picture uploaded.");
    } catch (requestError) {
      setBlogMessage(requestError.message || "Could not upload blog picture.");
    } finally {
      setIsBlogImageUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteBlog = async (blog) => {
    const shouldDelete = window.confirm(`Delete blog post "${blog.title}"?`);
    if (!shouldDelete) return;
    setBlogMessage("");
    try {
      await deleteBlog(blog.id);
      syncBlogs(blogs.filter((item) => item.id !== blog.id));
      if (blogDraft.id === blog.id) resetBlogDraft();
      setBlogMessage("Blog post deleted.");
    } catch (requestError) {
      setBlogMessage(requestError.message || "Could not delete blog post.");
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

  const handleSettingsModalSubmit = async (event) => {
    await onSaveSettings(event);
    setActiveModal(null);
  };

  const closeModal = () => {
    if (activeModal === "blog") resetBlogDraft();
    if (activeModal === "product") onCancelEdit?.();
    resetModalFeedback();
    setActiveModal(null);
  };

  return (
    <div className={`page admin-page admin-theme-${adminTheme} ${isNavOpen ? "admin-nav-open" : ""}`}>
      {isNavOpen ? <button type="button" className="admin-nav-backdrop" aria-label="Close navigation" onClick={() => setIsNavOpen(false)} /> : null}
      <aside className={`admin-sidebar ${isNavOpen ? "is-open" : ""}`} aria-label="Admin navigation">
        <div className="admin-sidebar-brand">
          <img className="admin-brand-logo" src="/brand/ife-logo-circle.png" alt="" />
          <span className="admin-brand-text">
            IfeShades<span>n</span>More
          </span>
        </div>

        <nav className="admin-tabs" aria-label="Admin sections">
          <p>Admin</p>
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => {
                setActiveTab(tab.id);
                setIsNavOpen(false);
              }}
            >
              <span>
                <AdminIcon name={tab.icon} />
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-user">
          <span className="admin-profile-avatar">
            <img src="/brand/ife-logo-circle.png" alt="" />
          </span>
          <div>
            <strong>{adminName}</strong>
            <small>Store owner</small>
          </div>
          <button type="button" className="admin-sidebar-logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-button"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open admin navigation"
          >
            <span className="admin-menu-lines" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
          <strong className="admin-mobile-title">{activeTabMeta.label}</strong>
          <div className="admin-search-shell">
            <span className="admin-search-icon">
              <AdminIcon name="search" />
            </span>
            <span aria-hidden="true">⌕</span>
            <input placeholder="Search orders, products, customers..." type="search" />
          </div>
          <div className="admin-topbar-actions">
            <div className={`admin-theme-picker ${isThemeOpen ? "is-open" : ""}`} aria-label="Admin theme selector">
              <button
                type="button"
                className="admin-theme-toggle"
                onClick={() => setIsThemeOpen((current) => !current)}
                aria-expanded={isThemeOpen}
                aria-label={`Theme: ${activeThemeMeta.label}`}
              >
                <span className="admin-theme-orbit" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>{activeThemeMeta.label}</span>
                <AdminIcon name="chevron" />
              </button>
              <div className="admin-theme-menu" aria-hidden={!isThemeOpen}>
                {ADMIN_THEME_OPTIONS.map((themeOption) => (
                  <button
                    key={themeOption.id}
                    type="button"
                    className={adminTheme === themeOption.id ? "is-active" : ""}
                    onClick={() => {
                      setAdminTheme(themeOption.id);
                      setIsThemeOpen(false);
                    }}
                    aria-pressed={adminTheme === themeOption.id}
                  >
                    {themeOption.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="secondary-action admin-storefront-text-button" onClick={onOpenStorefront}>
              Storefront
            </button>
            <button type="button" className="admin-storefront-icon-button" onClick={onOpenStorefront} aria-label="Open storefront">
              <AdminIcon name="storefront" />
            </button>
            <button type="button" className="admin-bell-button" aria-label="Notifications">
              <AdminIcon name="bell" />
              <span />
            </button>
          </div>
        </header>

        <main className="site-shell admin-shell">
          <section className="admin-page-heading">
            <div>
              <p>
                <AdminIcon name={activeTabMeta.icon} />
              </p>
              <h1>{activeTabMeta.label}</h1>
              <span>Welcome back. Here is what is happening with your store today.</span>
            </div>
          </section>

          <section className="admin-kpi-grid">
            <article className="admin-kpi-card">
              <p>Total Orders</p>
              <h2>{paidOrders.length}</h2>
              <span>Paid orders only</span>
            </article>
            <article className="admin-kpi-card">
              <p>Pending</p>
              <h2>{pendingOrders}</h2>
              <span>Needs attention</span>
            </article>
            <article className="admin-kpi-card">
              <p>Paid Revenue</p>
              <h2>{toPrice(totalRevenue)}</h2>
              <span>Confirmed payments</span>
            </article>
            <article className="admin-kpi-card">
              <p>Customers</p>
              <h2>{customers.length}</h2>
              <span>Registered accounts</span>
            </article>
          </section>

          {isLoadingData ? <p className="admin-hint">Loading admin data...</p> : null}
          {dataError ? <p className="form-error">{dataError}</p> : null}
          {orderStatusNotice ? <p className="form-success">{orderStatusNotice}</p> : null}
          {orderStatusError ? <p className="form-error">{orderStatusError}</p> : null}
          {customerActionNotice ? <p className="form-success">{customerActionNotice}</p> : null}
          {customerActionError ? <p className="form-error">{customerActionError}</p> : null}
          {modalMessage ? <p className="form-success">{modalMessage}</p> : null}
          {adminMessage ? <p className="form-success">{adminMessage}</p> : null}

          <div className="admin-sections">
          <form className={`admin-section-card admin-form-card admin-modal-card ${activeModal === "order" ? "is-open" : ""}`} onSubmit={handleCreateOrder}>
            <header className="admin-section-header">
              <h2>Create Order</h2>
              <p>Create an order manually from existing products.</p>
              <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Close order creator">
                x
              </button>
            </header>
            {modalError && activeModal === "order" ? <p className="form-error">{modalError}</p> : null}
            <label>
              Existing customer
              <select
                value={orderDraft.customerId}
                onChange={(event) => {
                  const customerId = event.target.value;
                  const customer = customers.find((entry) => String(entry.id) === String(customerId));
                  setOrderDraft((current) => ({
                    ...current,
                    customerId,
                    fullName: customer?.fullName || "",
                    email: customer?.email || "",
                    phone: customer?.phone || current.phone,
                    address: customer?.address || current.address,
                    city: customer?.city || current.city
                  }));
                }}
              >
                <option value="">New or guest customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName || customer.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Customer name
              <input
                value={orderDraft.fullName}
                onChange={(event) => setOrderDraftField("fullName", event.target.value)}
                disabled={Boolean(orderDraft.customerId)}
              />
            </label>
            <label>
              Customer email
              <input
                type="email"
                value={orderDraft.email}
                onChange={(event) => setOrderDraftField("email", event.target.value)}
                disabled={Boolean(orderDraft.customerId)}
              />
            </label>
            <label>
              Phone
              <input value={orderDraft.phone} onChange={(event) => setOrderDraftField("phone", event.target.value)} required />
            </label>
            <label>
              Address
              <input value={orderDraft.address} onChange={(event) => setOrderDraftField("address", event.target.value)} required />
            </label>
            <label>
              City
              <input value={orderDraft.city} onChange={(event) => setOrderDraftField("city", event.target.value)} required />
            </label>
            <div className="admin-section-grid admin-compact-grid">
              <label>
                Payment method
                <select value={orderDraft.paymentMethod} onChange={(event) => setOrderDraftField("paymentMethod", event.target.value)}>
                  <option value="transfer">Transfer</option>
                  <option value="card">Card</option>
                </select>
              </label>
              <label>
                Payment status
                <select value={orderDraft.paymentStatus} onChange={(event) => setOrderDraftField("paymentStatus", event.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label>
                Order status
                <select value={orderDraft.orderStatus} onChange={(event) => setOrderDraftField("orderStatus", event.target.value)}>
                  {ORDER_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-bullet-editor">
              <h3>Order items</h3>
              {orderDraft.items.map((item, index) => (
                <div className="admin-bullet-row" key={`order-item-${index}`}>
                  <select value={item.productId} onChange={(event) => setOrderDraftItem(index, "productId", event.target.value)} required>
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {toPrice(product.price)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={item.quantity}
                    onChange={(event) => setOrderDraftItem(index, "quantity", event.target.value)}
                    required
                  />
                  <button type="button" className="secondary-action danger-action" onClick={() => removeOrderDraftItem(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="secondary-action" onClick={addOrderDraftItem}>
                Add Item
              </button>
            </div>
            <div className="admin-inline-actions">
              <button type="submit" className="primary-action">Create Order</button>
              <button type="button" className="secondary-action" onClick={closeModal}>Cancel</button>
            </div>
          </form>

          <form className={`admin-section-card admin-form-card admin-modal-card ${activeModal === "customer" ? "is-open" : ""}`} onSubmit={handleCreateCustomer}>
            <header className="admin-section-header">
              <h2>Create Customer</h2>
              <p>Add a customer record for manual orders and future checkout history.</p>
              <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Close customer creator">
                x
              </button>
            </header>
            {modalError && activeModal === "customer" ? <p className="form-error">{modalError}</p> : null}
            <label>
              Full name
              <input value={customerDraft.fullName} onChange={(event) => setCustomerDraft((current) => ({ ...current, fullName: event.target.value }))} required />
            </label>
            <label>
              Email
              <input type="email" value={customerDraft.email} onChange={(event) => setCustomerDraft((current) => ({ ...current, email: event.target.value }))} required />
            </label>
            <label>
              Phone
              <input value={customerDraft.phone} onChange={(event) => setCustomerDraft((current) => ({ ...current, phone: event.target.value }))} required />
            </label>
            <label>
              Address
              <input value={customerDraft.address} onChange={(event) => setCustomerDraft((current) => ({ ...current, address: event.target.value }))} />
            </label>
            <label>
              City
              <input value={customerDraft.city} onChange={(event) => setCustomerDraft((current) => ({ ...current, city: event.target.value }))} />
            </label>
            <div className="admin-inline-actions">
              <button type="submit" className="primary-action">Create Customer</button>
              <button type="button" className="secondary-action" onClick={closeModal}>Cancel</button>
            </div>
          </form>

          <form className={`admin-section-card admin-form-card admin-modal-card ${activeModal === "subscriber" ? "is-open" : ""}`} onSubmit={handleCreateSubscriber}>
            <header className="admin-section-header">
              <h2>Add Subscriber</h2>
              <p>Add an email to the newsletter list.</p>
              <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Close subscriber creator">
                x
              </button>
            </header>
            {modalError && activeModal === "subscriber" ? <p className="form-error">{modalError}</p> : null}
            <label>
              Email
              <input type="email" value={subscriberDraft.email} onChange={(event) => setSubscriberDraft((current) => ({ ...current, email: event.target.value }))} required />
            </label>
            <label>
              Source
              <input value={subscriberDraft.source} onChange={(event) => setSubscriberDraft((current) => ({ ...current, source: event.target.value }))} />
            </label>
            <div className="admin-inline-actions">
              <button type="submit" className="primary-action">Add Subscriber</button>
              <button type="button" className="secondary-action" onClick={closeModal}>Cancel</button>
            </div>
          </form>

          {activeTab === "orders" ? (
            <section className="admin-section-card">
              <header className="admin-section-header">
                <div>
                  <h2>Orders</h2>
                  <p>Manage fulfillment status, payment details, and delivery information.</p>
                </div>
                <button type="button" className="primary-action" onClick={() => openModal("order")}>
                  Create Order
                </button>
              </header>

              <div className="admin-order-tabs" role="tablist" aria-label="Order filters">
                {ORDER_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={orderFilter === filter.id ? "is-active" : ""}
                    onClick={() => setOrderFilter(filter.id)}
                    role="tab"
                    aria-selected={orderFilter === filter.id}
                  >
                    {filter.label}
                    <span>
                      {filter.id === "orders"
                          ? paidOrders.length
                          : filter.id === "failed"
                            ? orders.filter((order) => order.paymentStatus === "failed").length
                            : pendingOrders}
                    </span>
                  </button>
                ))}
              </div>

              <div className="admin-order-list">
                {filteredOrders.length === 0 ? <p className="admin-hint">No orders in this tab yet.</p> : null}
                {filteredOrders.map((order) => (
                  <article className="admin-order-card" key={order.id}>
                    <div className="admin-order-main">
                      <div>
                        <h3>{order.id}</h3>
                        <p>
                          {new Date(order.createdAt).toLocaleString()} · {toPrice(order.subtotal)}
                        </p>
                      </div>
                      <div className="admin-status-row">
                        <span className={`order-status status-${order.paymentStatus}`}>
                          Payment: {order.paymentStatus}
                        </span>
                        <div className="admin-order-status-control">
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
                <div>
                  <h2>Customers</h2>
                  <p>People registered as customer accounts.</p>
                </div>
                <button type="button" className="primary-action" onClick={() => openModal("customer")}>
                  Create Customer
                </button>
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
                <div>
                  <h2>Subscribers</h2>
                  <p>Email list from your "Stay Updated" form.</p>
                </div>
                <button type="button" className="primary-action" onClick={() => openModal("subscriber")}>
                  Add Subscriber
                </button>
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

          {activeTab === "blogs" ? (
            <section className="admin-section-grid">
              <form className={`admin-section-card admin-form-card admin-modal-card ${activeModal === "blog" ? "is-open" : ""}`} onSubmit={handleBlogSubmit}>
                <header className="admin-section-header">
                  <h2>{isEditingBlog ? "Edit Blog Post" : "Write Blog Post"}</h2>
                  <p>Create journal entries that appear in the storefront editorial swiper.</p>
                  <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Close blog editor">
                    x
                  </button>
                </header>
                <label>
                  Title
                  <input
                    value={blogDraft.title}
                    onChange={(event) => setBlogDraft((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Excerpt
                  <input
                    maxLength={260}
                    value={blogDraft.excerpt}
                    onChange={(event) => setBlogDraft((current) => ({ ...current, excerpt: event.target.value }))}
                    placeholder="Short teaser for the editorial swiper"
                  />
                </label>
                <label>
                  Content
                  <textarea
                    rows={8}
                    value={blogDraft.content}
                    onChange={(event) => setBlogDraft((current) => ({ ...current, content: event.target.value }))}
                    placeholder="Write the full blog post. Separate paragraphs with a blank line."
                    required
                  />
                </label>
                <label className="admin-image-upload-field">
                  Blog picture
                  {blogDraft.image ? (
                    <span className="admin-image-preview">
                      <img src={blogDraft.image} alt="" />
                    </span>
                  ) : null}
                  <input type="file" accept="image/*" onChange={handleBlogImageUpload} />
                  <span className="admin-hint">
                    {isBlogImageUploading ? "Saving picture..." : "Choose the image that will appear on the blog page and editorial section."}
                  </span>
                </label>
                <label>
                  Author
                  <input
                    value={blogDraft.author}
                    onChange={(event) => setBlogDraft((current) => ({ ...current, author: event.target.value }))}
                  />
                </label>
                <label className="admin-audience-option">
                  <input
                    type="checkbox"
                    checked={blogDraft.isPublished}
                    onChange={(event) =>
                      setBlogDraft((current) => ({ ...current, isPublished: event.target.checked }))
                    }
                  />
                  <span>Publish on storefront</span>
                </label>
                {blogMessage ? <p className={blogMessage.includes("Could not") ? "form-error" : "form-success"}>{blogMessage}</p> : null}
                <div className="admin-inline-actions">
                  <button type="submit" className="primary-action">
                    {isEditingBlog ? "Update Blog" : "Save Blog"}
                  </button>
                  {isEditingBlog ? (
                    <button type="button" className="secondary-action" onClick={resetBlogDraft}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>

              <section className="admin-section-card admin-list-card">
                <header className="admin-section-header">
                  <h2>Current Blog Posts</h2>
                  <p>Published posts rotate in the editorial section and link to blog pages.</p>
                  <button type="button" className="primary-action" onClick={openAddBlogModal}>
                    Write Blog
                  </button>
                </header>
                <ul className="admin-product-list admin-blog-list">
                  {blogs.length === 0 ? <li>No blog posts yet.</li> : null}
                  {blogs.map((blog) => (
                    <li key={blog.id}>
                      {blog.image ? (
                        <div className="mini-media">
                          <img src={blog.image} alt="" />
                        </div>
                      ) : null}
                      <div>
                        <strong>{blog.title}</strong>
                        <span>{blog.isPublished ? "Published" : "Draft"} | {blog.author || "IfeShadesnMore"}</span>
                        <span>{blog.excerpt || "No excerpt yet."}</span>
                      </div>
                      <div className="admin-list-actions">
                        <button type="button" className="secondary-action" onClick={() => startEditBlog(blog)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary-action danger-action"
                          onClick={() => handleDeleteBlog(blog)}
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

          {activeTab === "products" ? (
            <section className="admin-section-grid">
              <form className={`admin-section-card admin-form-card admin-modal-card ${activeModal === "product" ? "is-open" : ""}`} onSubmit={handleProductModalSubmit}>
                <header className="admin-section-header">
                  <h2>{isEditing ? "Edit Product" : "Add Product"}</h2>
                  <p>Create and update products in each collection.</p>
                  <button type="button" className="admin-modal-close" onClick={closeProductModal} aria-label="Close product editor">
                    x
                  </button>
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
                  Availability
                  <select
                    value={productDraft.availability || "in_stock"}
                    onChange={(event) => onProductDraftChange("availability", event.target.value)}
                  >
                    {PRODUCT_AVAILABILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {String(productDraft.availability || "in_stock") === "preorder" ? (
                  <label>
                    Preorder note
                    <input
                      placeholder="Available on preorder. Ships in 3-7 working days."
                      value={productDraft.preorderNote || ""}
                      onChange={(event) => onProductDraftChange("preorderNote", event.target.value)}
                    />
                  </label>
                ) : null}
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
                  Product detail bullets (one per line)
                  <textarea
                    rows={4}
                    placeholder={"Blue light filter compatible\nUnisex fit\nFree cleaning cloth included"}
                    value={productDraft.detailBulletsText || ""}
                    onChange={(event) => onProductDraftChange("detailBulletsText", event.target.value)}
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
                    <option value="butterfly">Butterfly</option>
                    <option value="clear">Clear</option>
                    <option value="square">Square</option>
                    <option value="aviator">Aviator</option>
                  </select>
                </label>
                <label className="admin-image-upload-field">
                  Product picture
                  {productDraft.image ? (
                    <span className="admin-image-preview">
                      <img src={productDraft.image} alt="" />
                    </span>
                  ) : null}
                  <input type="file" accept="image/*" onChange={onProductUpload} />
                  <span className="admin-hint">Choose the product image customers will see on the storefront.</span>
                </label>

                <div className="admin-inline-actions">
                  <button type="submit" className="primary-action">
                    {isEditing ? "Update Product" : "Add Product"}
                  </button>
                  {isEditing ? (
                    <button type="button" className="secondary-action" onClick={closeProductModal}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>

              <section className="admin-section-card admin-list-card">
                <header className="admin-section-header">
                  <h2>Current Products</h2>
                  <p>Tap edit to modify product details quickly.</p>
                  <button type="button" className="primary-action" onClick={openAddProductModal}>
                    Add Product
                  </button>
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
                        <span>
                          Availability: {formatAvailabilityLabel(product.availability || "in_stock")}
                          {String(product.availability || "") === "preorder" && product.preorderNote
                            ? ` | ${product.preorderNote}`
                            : ""}
                        </span>
                      </div>
                      <div className="admin-list-actions">
                        <button type="button" className="secondary-action" onClick={() => openEditProductModal(product)}>
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
            <section className={`admin-section-card admin-form-card admin-modal-card ${activeModal === "settings" ? "is-open" : ""}`}>
              <header className="admin-section-header">
                <h2>Store Settings</h2>
                <p>Update brand text and hero section content.</p>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Close settings editor">
                  x
                </button>
              </header>

              <form onSubmit={handleSettingsModalSubmit} className="admin-settings-form">
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
                  Hero small text
                  <input
                    placeholder="Leave blank for current month, e.g. June Drop"
                    value={settingsDraft.heroKicker || ""}
                    onChange={(event) => onSettingsDraftChange("heroKicker", event.target.value)}
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
          {activeTab === "settings" ? (
            <section className="admin-section-card admin-list-card">
              <header className="admin-section-header">
                <h2>Store Settings</h2>
                <p>Open the settings editor to update brand, hero, and storefront text.</p>
                <button type="button" className="primary-action" onClick={() => setActiveModal("settings")}>
                  Edit Settings
                </button>
              </header>
            </section>
          ) : null}
          </div>
        </main>
      </div>
      {activeModal ? <button type="button" className="admin-modal-backdrop" aria-label="Close modal" onClick={closeModal} /> : null}
    </div>
  );
}

export default AdminOverlay;
