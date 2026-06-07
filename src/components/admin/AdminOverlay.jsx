import { useEffect, useMemo, useState } from "react";
import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";
import { getStoredThemeVariant, persistThemeVariant } from "../../utils/themePreference";
import {
  AUDIENCE_OPTIONS,
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
  sendNewsletter,
  updateBlog,
  updateOrderStatus,
  updateSubscription,
  uploadImage
} from "../../utils/api";

const ADMIN_TABS = [
  { id: "overview", label: "Overview", icon: "overview" },
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

const ORDER_STATUS_OPTIONS = ["processing", "shipped", "delivered", "cancelled"];
const ORDER_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" }
];

const ADMIN_PAGE_COPY = {
  overview: ["Overview", "Welcome back, Ife. Here's what's happening with your store today."],
  orders: ["Orders", "Manage fulfillment, payments and delivery in one place."],
  customers: ["Customers", "People who shop with you. Tap a row for full history."],
  subscribers: ["Subscribers", "Your newsletter audience. Ready to ship the next drop."],
  blogs: ["Blogs", "Write and publish journal posts for the storefront."],
  products: ["Products", "Your catalog. Add, edit, or restock in seconds."],
  settings: ["Store settings", "Control your brand text, homepage content and account preferences."]
};

const REVENUE_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
const EMPTY_NEWSLETTER_DRAFT = {
  subject: "",
  message: "",
  campaignType: "general"
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
  orderStatus: "processing",
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
  if (name === "overview") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
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

  if (name === "trash") {
    return (
      <svg {...sharedProps}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
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

function AdminBadge({ children, tone = "neutral" }) {
  return <span className={`la-badge la-badge-${tone}`}>{children}</span>;
}

function StatCard({ label, value, delta, trend = "up" }) {
  return (
    <article className="la-stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {delta ? <span className={trend === "up" ? "is-up" : ""}>{delta}</span> : null}
    </article>
  );
}

function toneForStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["paid", "delivered", "in_stock"].includes(status)) return "success";
  if (["failed", "cancelled", "out_of_stock"].includes(status)) return "danger";
  if (["pending", "processing", "shipped", "preorder"].includes(status)) return "gold";
  return "neutral";
}

function formatOrderDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function initialsFor(value) {
  const text = String(value || "Owner").trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

function orderCustomerName(order) {
  return order?.fullName || order?.email || "Customer";
}

function normalizeOrderStatus(order) {
  return String(order?.orderStatus || "pending").toLowerCase();
}

function isPaidOrder(order) {
  return String(order?.paymentStatus || "").toLowerCase() === "paid";
}

function matchesOrderFilter(order, filter) {
  const paymentStatus = String(order?.paymentStatus || "pending").toLowerCase();
  const orderStatus = normalizeOrderStatus(order);
  if (filter === "all") return paymentStatus === "paid";
  if (filter === "pending") return paymentStatus === "pending";
  if (filter === "failed") return paymentStatus === "failed";
  return paymentStatus === "paid" && orderStatus === filter;
}

function availabilityTone(availability) {
  const value = String(availability || "in_stock");
  if (value === "out_of_stock") return "danger";
  if (value === "preorder") return "warning";
  return "success";
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
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [blogDraft, setBlogDraft] = useState(EMPTY_BLOG_DRAFT);
  const [customerDraft, setCustomerDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [subscriberDraft, setSubscriberDraft] = useState(EMPTY_SUBSCRIBER_DRAFT);
  const [newsletterDraft, setNewsletterDraft] = useState(EMPTY_NEWSLETTER_DRAFT);
  const [newsletterExcludedIds, setNewsletterExcludedIds] = useState([]);
  const [isSendingNewsletter, setIsSendingNewsletter] = useState(false);
  const [orderDraft, setOrderDraft] = useState(EMPTY_ORDER_DRAFT);
  const [isEditingBlog, setIsEditingBlog] = useState(false);
  const [isBlogImageUploading, setIsBlogImageUploading] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [orderStatusDrafts, setOrderStatusDrafts] = useState({});
  const [orderFilter, setOrderFilter] = useState("all");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [settingsSection, setSettingsSection] = useState("shipping");
  const [orderStatusNotice, setOrderStatusNotice] = useState("");
  const [orderStatusError, setOrderStatusError] = useState("");
  const [customerActionNotice, setCustomerActionNotice] = useState("");
  const [customerActionError, setCustomerActionError] = useState("");
  const [adminTheme, setAdminTheme] = useState("v1");
  const [isAdminThemeHydrated, setIsAdminThemeHydrated] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [adminToasts, setAdminToasts] = useState([]);

  const selectedAudiences = useMemo(
    () => normalizeAudienceSelections(productDraft.audiences),
    [productDraft.audiences]
  );
  const activeTabMeta = ADMIN_TABS.find((tab) => tab.id === activeTab) || ADMIN_TABS[0];
  const activeThemeMeta = ADMIN_THEME_OPTIONS.find((themeOption) => themeOption.id === adminTheme) || ADMIN_THEME_OPTIONS[0];
  const adminName = currentUser?.fullName || currentUser?.email || "Owner";
  const adminInitial = String(adminName || "I").trim().charAt(0).toUpperCase() || "I";

  const pushAdminToast = (message, tone = "error") => {
    const text = String(message || "").trim();
    if (!text) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAdminToasts((current) => [...current.slice(-3), { id, tone, message: text }]);
    window.setTimeout(() => {
      setAdminToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5200);
  };

  const dismissAdminToast = (id) => {
    setAdminToasts((current) => current.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    setAdminTheme(getStoredThemeVariant());
    setIsAdminThemeHydrated(true);
  }, []);

  useEffect(() => {
    if (!isAdminThemeHydrated) return;
    persistThemeVariant(adminTheme);
  }, [adminTheme, isAdminThemeHydrated]);

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

  useEffect(() => {
    if (dataError) pushAdminToast(dataError, "error");
  }, [dataError]);

  useEffect(() => {
    if (orderStatusError) pushAdminToast(orderStatusError, "error");
  }, [orderStatusError]);

  useEffect(() => {
    if (customerActionError) pushAdminToast(customerActionError, "error");
  }, [customerActionError]);

  useEffect(() => {
    if (modalError) pushAdminToast(modalError, "error");
  }, [modalError]);

  const totalRevenue = useMemo(
    () =>
      orders
        .filter(isPaidOrder)
        .reduce((sum, order) => sum + (Number(order.total ?? order.subtotal) || 0), 0),
    [orders]
  );

  const paidOrders = useMemo(
    () => orders.filter(isPaidOrder),
    [orders]
  );

  const pendingOrders = useMemo(
    () => orders.filter((order) => String(order.paymentStatus || "pending").toLowerCase() === "pending").length,
    [orders]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => matchesOrderFilter(order, orderFilter));
  }, [orderFilter, orders]);

  const revenueSeries = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    start.setHours(0, 0, 0, 0);

    return REVENUE_DAYS.map((day, index) => {
      const target = new Date(start);
      target.setDate(start.getDate() + index);
      const value = paidOrders
        .filter((order) => {
          const created = new Date(order.createdAt);
          return (
            !Number.isNaN(created.getTime()) &&
            created.getFullYear() === target.getFullYear() &&
            created.getMonth() === target.getMonth() &&
            created.getDate() === target.getDate()
          );
        })
        .reduce((sum, order) => sum + (Number(order.subtotal) || 0), 0);
      return { day, value };
    });
  }, [paidOrders]);

  const maxRevenue = useMemo(
    () => Math.max(1, ...revenueSeries.map((entry) => entry.value)),
    [revenueSeries]
  );

  const topProducts = useMemo(() => {
    const summary = new Map();
    paidOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.name;
        const current = summary.get(key) || {
          id: key,
          name: item.name || "Product",
          quantity: 0,
          revenue: 0
        };
        current.quantity += Number(item.quantity) || 0;
        current.revenue += Number(item.lineTotal) || 0;
        summary.set(key, current);
      });
    });

    const realTop = [...summary.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 4);
    return realTop;
  }, [paidOrders]);

  const visibleProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !search || String(product.name || "").toLowerCase().includes(search);
      const availability = String(product.availability || "in_stock");
      const matchesFilter = productFilter === "all" || availability === productFilter;
      return matchesSearch && matchesFilter;
    });
  }, [productFilter, productSearch, products]);

  const subscriberStats = useMemo(() => {
    const optedOut = subscriptions.filter((subscription) => subscription.isOptedOut).length;
    const excluded = subscriptions.filter((subscription) => subscription.excludedFromCampaigns && !subscription.isOptedOut).length;
    const sendable = subscriptions.filter((subscription) => !subscription.isOptedOut && !subscription.excludedFromCampaigns).length;
    return { optedOut, excluded, sendable };
  }, [subscriptions]);

  const handleOrderStatusSave = async (orderId) => {
    const nextStatus = orderStatusDrafts[orderId] || "processing";
    setOrderStatusNotice("");
    setOrderStatusError("");
    const targetOrder = orders.find((order) => order.id === orderId);
    if (!isPaidOrder(targetOrder)) {
      setOrderStatusError("Only paid orders can be moved through fulfillment.");
      return;
    }

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
    if (activeTab === "overview") return { label: "Add product", modal: "product" };
    if (activeTab === "orders") return { label: "Create Order", modal: "order" };
    if (activeTab === "customers") return { label: "Create Customer", modal: "customer" };
    if (activeTab === "subscribers") return { label: "Add Subscriber", modal: "subscriber" };
    if (activeTab === "blogs") return { label: "New blog post", modal: "blog" };
    if (activeTab === "products") return { label: "New product", modal: "product" };
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
      const savedSubscription = result?.subscription;
      setSubscriptions((current) => [
        savedSubscription || {
          id: result?.id || `new-${Date.now()}`,
          email: subscriberDraft.email,
          source: subscriberDraft.source || "admin",
          isOptedOut: false,
          optedOutAt: null,
          excludedFromCampaigns: false,
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

  const openNewsletterModal = () => {
    setNewsletterDraft(EMPTY_NEWSLETTER_DRAFT);
    setNewsletterExcludedIds([]);
    openModal("newsletter");
  };

  const toggleNewsletterExclusion = (subscriptionId) => {
    const id = Number(subscriptionId);
    setNewsletterExcludedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  };

  const handleSubscriptionPreference = async (subscription, field, value) => {
    resetModalFeedback();
    try {
      const payload = field === "excludedFromCampaigns"
        ? { excludedFromCampaigns: value }
        : { isOptedOut: value };
      const result = await updateSubscription(subscription.id, payload);
      const updatedSubscription = result?.subscription;
      if (!updatedSubscription) throw new Error("Could not update subscriber.");
      setSubscriptions((current) =>
        current.map((entry) => (entry.id === updatedSubscription.id ? updatedSubscription : entry))
      );
      pushAdminToast("Subscriber preference updated.", "success");
    } catch (requestError) {
      pushAdminToast(requestError.message || "Could not update subscriber.", "error");
    }
  };

  const handleSendNewsletter = async (event) => {
    event.preventDefault();
    resetModalFeedback();
    setIsSendingNewsletter(true);
    try {
      const result = await sendNewsletter({
        subject: newsletterDraft.subject,
        message: newsletterDraft.message,
        campaignType: newsletterDraft.campaignType,
        excludedSubscriptionIds: newsletterExcludedIds
      });
      setNewsletterDraft(EMPTY_NEWSLETTER_DRAFT);
      setNewsletterExcludedIds([]);
      setActiveModal(null);
      pushAdminToast(`Newsletter sent to ${result.deliveredCount || 0} subscriber${Number(result.deliveredCount) === 1 ? "" : "s"}.`, "success");
      if (Number(result.failedCount || 0) > 0) {
        pushAdminToast(`${result.failedCount} newsletter email${Number(result.failedCount) === 1 ? "" : "s"} could not be delivered.`, "error");
      }
    } catch (requestError) {
      setModalError(requestError.message || "Could not send newsletter.");
    } finally {
      setIsSendingNewsletter(false);
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
    resetModalFeedback();
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
      pushAdminToast(isEditingBlog ? "Blog post updated." : "Blog post published.", "success");
      resetBlogDraft();
      setActiveModal(null);
    } catch (requestError) {
      setModalError(requestError.message || "Could not save blog post.");
    }
  };

  const handleBlogImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetModalFeedback();
    setIsBlogImageUploading(true);
    try {
      const result = await uploadImage(file, "blog");
      setBlogDraft((current) => ({ ...current, image: result.secureUrl || "" }));
      pushAdminToast("Blog picture uploaded.", "success");
    } catch (requestError) {
      setModalError(requestError.message || "Could not upload blog picture.");
    } finally {
      setIsBlogImageUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteBlog = async (blog) => {
    const shouldDelete = window.confirm(`Delete blog post "${blog.title}"?`);
    if (!shouldDelete) return;
    resetModalFeedback();
    try {
      await deleteBlog(blog.id);
      syncBlogs(blogs.filter((item) => item.id !== blog.id));
      if (blogDraft.id === blog.id) resetBlogDraft();
      pushAdminToast("Blog post deleted.", "success");
    } catch (requestError) {
      pushAdminToast(requestError.message || "Could not delete blog post.", "error");
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

  const updateShippingTier = (index, field, value) => {
    const currentTiers = Array.isArray(settingsDraft.shippingTiers) ? settingsDraft.shippingTiers : [];
    const nextTiers = currentTiers.map((tier, tierIndex) =>
      tierIndex === index
        ? {
            ...tier,
            [field]: field === "fee" ? Math.max(0, Math.round(Number(value) || 0)) : field === "isActive" ? Boolean(value) : value
          }
        : tier
    );
    onSettingsDraftChange("shippingTiers", nextTiers);
  };

  const addShippingTier = () => {
    const currentTiers = Array.isArray(settingsDraft.shippingTiers) ? settingsDraft.shippingTiers : [];
    onSettingsDraftChange("shippingTiers", [
      ...currentTiers,
      {
        id: `shipping-${Date.now()}`,
        name: "New shipping tier",
        description: "",
        fee: 0,
        isActive: true
      }
    ]);
  };

  const removeShippingTier = (index) => {
    const currentTiers = Array.isArray(settingsDraft.shippingTiers) ? settingsDraft.shippingTiers : [];
    const nextTiers = currentTiers.filter((_, tierIndex) => tierIndex !== index);
    onSettingsDraftChange("shippingTiers", nextTiers);
  };

  const handleSettingsModalSubmit = async (event) => {
    await onSaveSettings(event);
    setActiveModal(null);
  };

  const closeModal = () => {
    if (activeModal === "blog") resetBlogDraft();
    if (activeModal === "newsletter") {
      setNewsletterDraft(EMPTY_NEWSLETTER_DRAFT);
      setNewsletterExcludedIds([]);
    }
    if (activeModal === "product") onCancelEdit?.();
    resetModalFeedback();
    setActiveModal(null);
  };

  return (
    <div className={`la-admin la-theme-${adminTheme} ${isNavOpen ? "is-nav-open" : ""}`}>
      {isNavOpen ? (
        <button type="button" className="la-nav-backdrop" aria-label="Close navigation" onClick={() => setIsNavOpen(false)} />
      ) : null}

      <aside className={`la-sidebar ${isNavOpen ? "is-open" : ""}`} aria-label="Admin navigation">
        <div className="la-brand">
          <span className="la-brand-mark">I</span>
          <span>IfeShades<span>n</span>More</span>
        </div>
        <nav className="la-nav" aria-label="Admin sections">
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
              <AdminIcon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="la-owner-card">
          <span>{adminInitial}</span>
          <div>
            <strong>{adminName}</strong>
            <small>Owner</small>
          </div>
          <button type="button" onClick={onLogout} title="Logout">
            <AdminIcon name="profile" />
          </button>
        </div>
      </aside>

      <div className="la-main">
        <header className="la-topbar">
          <button type="button" className="la-icon-button la-menu-button" onClick={() => setIsNavOpen(true)} aria-label="Open admin navigation">
            <AdminIcon name="menu" />
          </button>
          <div className="la-search">
            <AdminIcon name="search" />
            <input placeholder="Search orders, products, customers..." type="search" />
            <kbd>⌘K</kbd>
          </div>
          <div className="la-topbar-actions">
            <div className={`la-theme-picker ${isThemeOpen ? "is-open" : ""}`}>
              <button type="button" className="la-theme-button" onClick={() => setIsThemeOpen((current) => !current)}>
                <AdminIcon name="theme" />
                <span>{activeThemeMeta.label}</span>
                <AdminIcon name="chevron" />
              </button>
              <div className="la-theme-menu">
                {ADMIN_THEME_OPTIONS.map((themeOption) => (
                  <button
                    key={themeOption.id}
                    type="button"
                    className={adminTheme === themeOption.id ? "is-active" : ""}
                    onClick={() => {
                      setAdminTheme(themeOption.id);
                      setIsThemeOpen(false);
                    }}
                  >
                    {themeOption.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="la-storefront-link" onClick={onOpenStorefront}>
              <AdminIcon name="storefront" />
              <span>View storefront</span>
            </button>
            <button type="button" className="la-icon-button" aria-label="Notifications">
              <AdminIcon name="bell" />
              <i />
            </button>
          </div>
        </header>

        <main className="la-content">
          <div className="la-page-heading">
            <div>
              <h1>{ADMIN_PAGE_COPY[activeTab]?.[0] || activeTabMeta.label}</h1>
              <p>{ADMIN_PAGE_COPY[activeTab]?.[1] || ""}</p>
            </div>
            {getPageAction() ? (
              <button type="button" className="la-primary-button" onClick={handlePageAction}>
                {getPageAction().label}
              </button>
            ) : null}
          </div>

          {isLoadingData ? <p className="la-notice">Loading admin data...</p> : null}
          {orderStatusNotice ? <p className="la-success">{orderStatusNotice}</p> : null}
          {customerActionNotice ? <p className="la-success">{customerActionNotice}</p> : null}
          {modalMessage ? <p className="la-success">{modalMessage}</p> : null}
          {adminMessage ? <p className="la-success">{adminMessage}</p> : null}

          {activeTab === "overview" ? (
            <>
              <section className="la-stats-grid">
                <StatCard label="Paid Orders" value={String(paidOrders.length)} delta="Ready for fulfillment" />
                <StatCard label="Pending Payments" value={String(pendingOrders)} delta="Awaiting payment" trend="down" />
                <StatCard label="Paid Revenue" value={toPrice(totalRevenue)} delta="Confirmed payments" />
                <StatCard label="Customers" value={String(customers.length)} delta="Registered accounts" />
              </section>

              <section className="la-overview-grid">
                <article className="la-card la-revenue-card">
                  <header>
                    <div>
                      <p>Revenue</p>
                      <h2>Last 7 days</h2>
                    </div>
                    <AdminBadge tone="gold">Live</AdminBadge>
                  </header>
                  <div className="la-bar-chart">
                    {revenueSeries.map((entry) => (
                      <div key={entry.day}>
                        <span style={{ height: `${Math.max(8, (entry.value / maxRevenue) * 100)}%` }} />
                        <small>{entry.day}</small>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="la-card la-top-sellers">
                  <p>Top sellers</p>
                  <ul>
                    {topProducts.map((product, index) => (
                      <li key={product.id || product.name}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.quantity} sold</small>
                        </div>
                        <em>{toPrice(product.revenue)}</em>
                      </li>
                    ))}
                  </ul>
                </article>
              </section>

              <section className="la-card la-table-card">
                <header>
                  <h2>Recent orders</h2>
                  <button type="button" onClick={() => setActiveTab("orders")}>View all</button>
                </header>
                <div className="la-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paidOrders.slice(0, 5).map((order) => (
                        <tr key={order.id}>
                          <td className="la-mono">{order.id}</td>
                          <td>{orderCustomerName(order)}</td>
                          <td>{formatOrderDate(order.createdAt)}</td>
                          <td><AdminBadge tone={toneForStatus(order.paymentStatus)}>{order.paymentStatus}</AdminBadge></td>
                          <td>{isPaidOrder(order) ? <AdminBadge tone={toneForStatus(order.orderStatus)}>{order.orderStatus || "processing"}</AdminBadge> : "-"}</td>
                          <td>{toPrice(order.total ?? order.subtotal)}</td>
                        </tr>
                      ))}
                      {paidOrders.length === 0 ? <tr><td colSpan={6}>No paid orders yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "orders" ? (
            <section>
              <div className="la-tabs">
                {ORDER_FILTERS.map((filter) => {
                  const count = orders.filter((order) => matchesOrderFilter(order, filter.id)).length;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      className={orderFilter === filter.id ? "is-active" : ""}
                      onClick={() => setOrderFilter(filter.id)}
                    >
                      {filter.label}
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="la-order-list">
                {filteredOrders.length === 0 ? <p className="la-notice">No orders in this tab yet.</p> : null}
                {filteredOrders.map((order) => {
                  const isOpen = expandedOrderId === order.id;
                  return (
                    <article className="la-order-row" key={order.id}>
                      <button type="button" className="la-order-summary" onClick={() => setExpandedOrderId(isOpen ? "" : order.id)}>
                        <span className={`la-row-toggle ${isOpen ? "is-open" : ""}`}><AdminIcon name="chevron" /></span>
                        <div>
                          <strong>{order.id}</strong>
                          <small>{formatOrderDate(order.createdAt)} · {orderCustomerName(order)}</small>
                        </div>
                        <span className="la-order-badges">
                          <AdminBadge tone={toneForStatus(order.paymentStatus)}>Payment: {order.paymentStatus}</AdminBadge>
                          {isPaidOrder(order) ? <AdminBadge tone={toneForStatus(order.orderStatus)}>{order.orderStatus || "processing"}</AdminBadge> : null}
                        </span>
                        <em>{toPrice(order.total ?? order.subtotal)}</em>
                      </button>
                      {isOpen ? (
                        <div className="la-order-details">
                          <section>
                            <h3>Delivery</h3>
                            <p>{orderCustomerName(order)}</p>
                            <p>{order.phone || "-"}</p>
                            <p>{order.address ? `${order.address}, ${order.city || ""}` : order.city || "-"}</p>
                          </section>
                          <section>
                            <h3>Payment</h3>
                            <p>Method: {order.paymentMethod}</p>
                            <p>Channel: {order.paymentChannel || "-"}</p>
                            <p>Ref: {order.paymentReference || "-"}</p>
                            <p>Items: {toPrice(order.subtotal)}</p>
                            <p>Shipping: {toPrice(order.shippingFee || 0)} {order.shippingTierName ? `(${order.shippingTierName})` : ""}</p>
                          </section>
                          <section>
                            <h3>Items</h3>
                            {(order.items || []).map((item) => (
                              <p key={`${order.id}-${item.id || item.productId || item.name}`}>
                                <span>{item.name}</span>
                                <span>x{item.quantity}</span>
                              </p>
                            ))}
                          </section>
                          <footer>
                            <label>
                              <span>Update status</span>
                              <select
                                value={orderStatusDrafts[order.id] || order.orderStatus || "processing"}
                                onChange={(event) => setOrderStatusDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                                disabled={!isPaidOrder(order)}
                              >
                                {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                              </select>
                            </label>
                            <button type="button" className="la-primary-button" onClick={() => handleOrderStatusSave(order.id)}>
                              Save changes
                            </button>
                          </footer>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeTab === "customers" ? (
            <section>
              <div className="la-search la-page-search">
                <AdminIcon name="search" />
                <input placeholder="Search by name, email, phone..." />
              </div>
              <div className="la-card la-table-card">
                <div className="la-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Contact</th>
                        <th>City</th>
                        <th>Orders</th>
                        <th>Spent</th>
                        <th>Joined</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer) => (
                        <tr key={customer.id}>
                          <td><span className="la-customer"><i>{initialsFor(customer.fullName || customer.email)}</i><strong>{customer.fullName || customer.email}</strong></span></td>
                          <td><span>{customer.email}</span><small>{customer.phone || "-"}</small></td>
                          <td>{customer.city || "-"}</td>
                          <td>{customer.orderCount || 0}</td>
                          <td>{toPrice(customer.totalSpent || 0)}</td>
                          <td>{formatOrderDate(customer.createdAt)}</td>
                          <td><button type="button" className="la-danger-text" onClick={() => handleDeleteCustomer(customer)}>Delete</button></td>
                        </tr>
                      ))}
                      {customers.length === 0 ? <tr><td colSpan={7}>No customers yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "subscribers" ? (
            <section>
              <div className="la-subscriber-stats">
                <StatCard label="Total subscribers" value={String(subscriptions.length)} delta="Newsletter list" />
                <StatCard label="Ready to send" value={String(subscriberStats.sendable)} delta="Active audience" />
                <StatCard label="Opted out" value={String(subscriberStats.optedOut)} delta={`${subscriberStats.excluded} excluded`} />
              </div>
              <div className="la-page-tools">
                <button type="button" className="la-primary-button" onClick={openNewsletterModal}>Send newsletter</button>
              </div>
              <div className="la-card la-table-card">
                <div className="la-table-wrap">
                  <table>
                    <thead><tr><th>Email</th><th>Source</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                    <tbody>
                      {subscriptions.map((subscription) => (
                        <tr key={subscription.id}>
                          <td>{subscription.email}</td>
                          <td>{subscription.source}</td>
                          <td>
                            {subscription.isOptedOut ? <AdminBadge tone="danger">Opted out</AdminBadge> : null}
                            {!subscription.isOptedOut && subscription.excludedFromCampaigns ? <AdminBadge tone="warning">Excluded</AdminBadge> : null}
                            {!subscription.isOptedOut && !subscription.excludedFromCampaigns ? <AdminBadge tone="success">Subscribed</AdminBadge> : null}
                          </td>
                          <td>{formatOrderDate(subscription.createdAt)}</td>
                          <td>
                            <div className="la-inline-actions">
                              <button
                                type="button"
                                onClick={() => handleSubscriptionPreference(subscription, "excludedFromCampaigns", !subscription.excludedFromCampaigns)}
                                disabled={subscription.isOptedOut}
                              >
                                {subscription.excludedFromCampaigns ? "Include" : "Exclude"}
                              </button>
                              {subscription.isOptedOut ? (
                                <button type="button" onClick={() => handleSubscriptionPreference(subscription, "isOptedOut", false)}>Resubscribe</button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {subscriptions.length === 0 ? <tr><td colSpan={5}>No subscribers yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "blogs" ? (
            <section>
              <div className="la-blog-grid">
                {blogs.map((blog) => (
                  <article key={blog.id} className="la-card la-blog-card">
                    {blog.image ? <img src={blog.image} alt="" /> : <div className="la-blog-placeholder"><AdminIcon name="blogs" /></div>}
                    <div>
                      <AdminBadge tone={blog.isPublished ? "success" : "warning"}>{blog.isPublished ? "Published" : "Draft"}</AdminBadge>
                      <h2>{blog.title}</h2>
                      <p>{blog.excerpt || "No excerpt yet."}</p>
                      <small>{formatOrderDate(blog.createdAt)} by {blog.author || "IfeShadesnMore"}</small>
                    </div>
                    <footer>
                      <button type="button" onClick={() => startEditBlog(blog)}>Edit</button>
                      <button type="button" className="la-danger-text" onClick={() => handleDeleteBlog(blog)}>Delete</button>
                    </footer>
                  </article>
                ))}
                {blogs.length === 0 ? <p className="la-notice">No blog posts yet.</p> : null}
              </div>
            </section>
          ) : null}

          {activeTab === "products" ? (
            <section>
              <div className="la-products-toolbar">
                <div className="la-search">
                  <AdminIcon name="search" />
                  <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products..." />
                </div>
                <div className="la-filter-pills">
                  {[["all", "All"], ["in_stock", "In stock"], ["preorder", "Preorder"], ["out_of_stock", "Out"]].map(([value, label]) => (
                    <button key={value} type="button" className={productFilter === value ? "is-active" : ""} onClick={() => setProductFilter(value)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="la-product-grid">
                {visibleProducts.map((product) => (
                  <article key={product.id} className="la-product-card">
                    <div className="la-product-media">
                      <ProductMedia product={product} />
                      <AdminBadge tone={availabilityTone(product.availability)}>{formatAvailabilityLabel(product.availability || "in_stock")}</AdminBadge>
                    </div>
                    <div className="la-product-copy">
                      <div><h3>{product.name}</h3><span>{toPrice(product.price)}</span></div>
                      <p>{product.section} · {formatAvailabilityLabel(product.availability || "in_stock")}</p>
                      <div>{normalizeAudienceSelections(product.audiences || [product.audience]).slice(0, 3).map((audience) => <AdminBadge key={audience}>{formatAudienceLabel(audience)}</AdminBadge>)}</div>
                      <footer>
                        <button type="button" onClick={() => openEditProductModal(product)}>Edit</button>
                        <button type="button" className="is-danger" onClick={() => onRemoveProduct(product.id)} aria-label={`Delete ${product.name}`}>
                          <AdminIcon name="trash" />
                        </button>
                      </footer>
                    </div>
                  </article>
                ))}
                {visibleProducts.length === 0 ? <p className="la-notice">No products match this filter.</p> : null}
              </div>
            </section>
          ) : null}

          {activeTab === "settings" ? (
            <section className="la-settings-layout">
              <nav className="la-settings-nav" aria-label="Settings sections">
                {[["shipping", "Shipping", "orders"], ["notifications", "Notifications", "bell"], ["security", "Security", "settings"]].map(([id, label, icon]) => (
                  <button key={id} type="button" className={settingsSection === id ? "is-active" : ""} onClick={() => setSettingsSection(id)}>
                    <AdminIcon name={icon} />{label}
                  </button>
                ))}
              </nav>
              <form className="la-settings-panels" onSubmit={onSaveSettings}>
                {settingsSection === "notifications" ? (
                  <section className="la-card la-settings-card">
                    <h2>Notifications</h2><p>Choose what hits your inbox.</p>
                    {["New order email", "Payment received", "Low stock alert", "Weekly summary"].map((label, index) => <div className="la-toggle-row" key={label}><span>{label}</span><i className={index < 3 ? "is-on" : ""} /></div>)}
                  </section>
                ) : null}
                {settingsSection === "shipping" ? (
                  <section className="la-card la-settings-card">
                    <h2>Shipping tiers</h2><p>Create checkout shipping options and fees.</p>
                    <div className="la-benefit-list">
                      {(Array.isArray(settingsDraft.shippingTiers) ? settingsDraft.shippingTiers : []).map((tier, index) => (
                        <div key={tier.id || `shipping-tier-${index}`} className="la-shipping-tier-row">
                          <label>Name<input value={tier.name} onChange={(event) => updateShippingTier(index, "name", event.target.value)} required /></label>
                          <label>Description<input value={tier.description || ""} onChange={(event) => updateShippingTier(index, "description", event.target.value)} /></label>
                          <label>Fee<input type="number" min="0" step="100" value={tier.fee} onChange={(event) => updateShippingTier(index, "fee", event.target.value)} required /></label>
                          <div className="la-toggle-row">
                            <span>Active</span>
                            <button type="button" className={tier.isActive !== false ? "is-on" : ""} onClick={() => updateShippingTier(index, "isActive", tier.isActive === false)} aria-label={`Toggle ${tier.name}`}>
                              <i className={tier.isActive !== false ? "is-on" : ""} />
                            </button>
                          </div>
                          <button type="button" className="la-danger-text" onClick={() => removeShippingTier(index)}>Remove</button>
                        </div>
                      ))}
                      {(!Array.isArray(settingsDraft.shippingTiers) || settingsDraft.shippingTiers.length === 0) ? (
                        <p className="la-notice">No shipping tiers yet.</p>
                      ) : null}
                    </div>
                    <button type="button" className="la-primary-button" onClick={addShippingTier}>Add shipping tier</button>
                  </section>
                ) : null}
                {settingsSection === "security" ? (
                  <section className="la-card la-settings-card">
                    <h2>Security</h2><p>Keep your account locked down.</p>
                    <label>Current password<input type="password" value="password" readOnly /></label>
                    <label>New password<input type="password" /></label>
                    <label>Confirm password<input type="password" /></label>
                    <div className="la-toggle-row"><span>Two-factor authentication</span><i /></div>
                  </section>
                ) : null}
                <div className="la-settings-save"><button type="submit" className="la-primary-button">Save changes</button></div>
              </form>
            </section>
          ) : null}
        </main>
      </div>

      {activeModal === "order" ? (
        <form className="la-modal-card is-open" onSubmit={handleCreateOrder}>
          <header>
            <div><h2>Create Order</h2><p>Create an order manually from existing products.</p></div>
            <button type="button" onClick={closeModal} aria-label="Close order creator">x</button>
          </header>
          <label>Existing customer<select value={orderDraft.customerId} onChange={(event) => {
            const customerId = event.target.value;
            const customer = customers.find((entry) => String(entry.id) === String(customerId));
            setOrderDraft((current) => ({ ...current, customerId, fullName: customer?.fullName || "", email: customer?.email || "", phone: customer?.phone || current.phone, address: customer?.address || current.address, city: customer?.city || current.city }));
          }}><option value="">New or guest customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName || customer.email}</option>)}</select></label>
          <div className="la-form-grid">
            <label>Customer name<input value={orderDraft.fullName} onChange={(event) => setOrderDraftField("fullName", event.target.value)} disabled={Boolean(orderDraft.customerId)} /></label>
            <label>Customer email<input type="email" value={orderDraft.email} onChange={(event) => setOrderDraftField("email", event.target.value)} disabled={Boolean(orderDraft.customerId)} /></label>
            <label>Phone<input value={orderDraft.phone} onChange={(event) => setOrderDraftField("phone", event.target.value)} required /></label>
            <label>City<input value={orderDraft.city} onChange={(event) => setOrderDraftField("city", event.target.value)} required /></label>
          </div>
          <label>Address<input value={orderDraft.address} onChange={(event) => setOrderDraftField("address", event.target.value)} required /></label>
          <div className="la-form-grid">
            <label>Payment method<select value={orderDraft.paymentMethod} onChange={(event) => setOrderDraftField("paymentMethod", event.target.value)}><option value="transfer">Transfer</option><option value="card">Card</option></select></label>
            <label>Payment status<select value={orderDraft.paymentStatus} onChange={(event) => setOrderDraftField("paymentStatus", event.target.value)}><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select></label>
            <label>Fulfillment status<select value={orderDraft.orderStatus} onChange={(event) => setOrderDraftField("orderStatus", event.target.value)}>{ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          </div>
          <div className="la-repeat-list">
            <h3>Order items</h3>
            {orderDraft.items.map((item, index) => (
              <div key={`order-item-${index}`}>
                <select value={item.productId} onChange={(event) => setOrderDraftItem(index, "productId", event.target.value)} required><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} - {toPrice(product.price)}</option>)}</select>
                <input type="number" min="1" max="99" value={item.quantity} onChange={(event) => setOrderDraftItem(index, "quantity", event.target.value)} required />
                <button type="button" onClick={() => removeOrderDraftItem(index)}>Remove</button>
              </div>
            ))}
            <button type="button" onClick={addOrderDraftItem}>Add item</button>
          </div>
          <footer><button type="button" onClick={closeModal}>Cancel</button><button type="submit" className="la-primary-button">Create order</button></footer>
        </form>
      ) : null}

      {activeModal === "customer" ? (
        <form className="la-modal-card is-open" onSubmit={handleCreateCustomer}>
          <header><div><h2>Create Customer</h2><p>Add a customer record for manual orders and future checkout history.</p></div><button type="button" onClick={closeModal}>x</button></header>
          <label>Full name<input value={customerDraft.fullName} onChange={(event) => setCustomerDraft((current) => ({ ...current, fullName: event.target.value }))} required /></label>
          <label>Email<input type="email" value={customerDraft.email} onChange={(event) => setCustomerDraft((current) => ({ ...current, email: event.target.value }))} required /></label>
          <div className="la-form-grid"><label>Phone<input value={customerDraft.phone} onChange={(event) => setCustomerDraft((current) => ({ ...current, phone: event.target.value }))} required /></label><label>City<input value={customerDraft.city} onChange={(event) => setCustomerDraft((current) => ({ ...current, city: event.target.value }))} /></label></div>
          <label>Address<input value={customerDraft.address} onChange={(event) => setCustomerDraft((current) => ({ ...current, address: event.target.value }))} /></label>
          <footer><button type="button" onClick={closeModal}>Cancel</button><button type="submit" className="la-primary-button">Create customer</button></footer>
        </form>
      ) : null}

      {activeModal === "subscriber" ? (
        <form className="la-modal-card is-open" onSubmit={handleCreateSubscriber}>
          <header><div><h2>Add Subscriber</h2><p>Add an email to the newsletter list.</p></div><button type="button" onClick={closeModal}>x</button></header>
          <label>Email<input type="email" value={subscriberDraft.email} onChange={(event) => setSubscriberDraft((current) => ({ ...current, email: event.target.value }))} required /></label>
          <label>Source<input value={subscriberDraft.source} onChange={(event) => setSubscriberDraft((current) => ({ ...current, source: event.target.value }))} /></label>
          <footer><button type="button" onClick={closeModal}>Cancel</button><button type="submit" className="la-primary-button">Add subscriber</button></footer>
        </form>
      ) : null}

      {activeModal === "newsletter" ? (
        <form className="la-modal-card is-open la-newsletter-modal" onSubmit={handleSendNewsletter}>
          <header><div><h2>Send Newsletter</h2><p>Email your active subscriber list.</p></div><button type="button" onClick={closeModal}>x</button></header>
          <label>Subject<input value={newsletterDraft.subject} onChange={(event) => setNewsletterDraft((current) => ({ ...current, subject: event.target.value }))} required /></label>
          <label>Campaign type<select value={newsletterDraft.campaignType} onChange={(event) => setNewsletterDraft((current) => ({ ...current, campaignType: event.target.value }))}>
            <option value="general">General update</option>
            <option value="drops">New drops</option>
            <option value="restocks">Restock alert</option>
            <option value="offers">Promotional offer</option>
          </select></label>
          <label>Message<textarea rows={8} value={newsletterDraft.message} onChange={(event) => setNewsletterDraft((current) => ({ ...current, message: event.target.value }))} required /></label>
          <section className="la-newsletter-exclusions">
            <h3>Exclude from this send</h3>
            <div>
              {subscriptions.map((subscription) => {
                const disabled = subscription.isOptedOut || subscription.excludedFromCampaigns;
                return (
                  <label key={subscription.id} className={disabled ? "is-disabled" : ""}>
                    <input
                      type="checkbox"
                      checked={disabled || newsletterExcludedIds.includes(Number(subscription.id))}
                      disabled={disabled}
                      onChange={() => toggleNewsletterExclusion(subscription.id)}
                    />
                    <span>{subscription.email}</span>
                    <small>{subscription.isOptedOut ? "Opted out" : subscription.excludedFromCampaigns ? "Excluded by admin" : "Subscribed"}</small>
                  </label>
                );
              })}
              {subscriptions.length === 0 ? <p className="la-notice">No subscribers yet.</p> : null}
            </div>
          </section>
          <footer><button type="button" onClick={closeModal}>Cancel</button><button type="submit" className="la-primary-button" disabled={isSendingNewsletter}>{isSendingNewsletter ? "Sending..." : "Send newsletter"}</button></footer>
        </form>
      ) : null}

      {activeModal === "blog" ? (
        <form className="la-modal-card is-open la-blog-modal" onSubmit={handleBlogSubmit}>
          <header><div><h2>{isEditingBlog ? "Edit Blog" : "New Blog"}</h2><p>Publish updates to the storefront journal.</p></div><button type="button" onClick={closeModal}>x</button></header>
          <label>Title<input value={blogDraft.title} onChange={(event) => setBlogDraft((current) => ({ ...current, title: event.target.value }))} required /></label>
          <label>Excerpt<textarea rows={3} value={blogDraft.excerpt} onChange={(event) => setBlogDraft((current) => ({ ...current, excerpt: event.target.value }))} /></label>
          <label>Content<textarea rows={9} value={blogDraft.content} onChange={(event) => setBlogDraft((current) => ({ ...current, content: event.target.value }))} required /></label>
          <div className="la-form-grid">
            <label>Author<input value={blogDraft.author} onChange={(event) => setBlogDraft((current) => ({ ...current, author: event.target.value }))} /></label>
            <label>Image URL<input value={blogDraft.image} onChange={(event) => setBlogDraft((current) => ({ ...current, image: event.target.value }))} /></label>
          </div>
          <label className="la-upload-card">Blog image{blogDraft.image ? <span><img src={blogDraft.image} alt="" /></span> : <span><AdminIcon name="blogs" /></span>}<input type="file" accept="image/*" onChange={handleBlogImageUpload} /><small>{isBlogImageUploading ? "Uploading..." : "PNG or JPG recommended."}</small></label>
          <div className="la-toggle-row">
            <span>Published</span>
            <button type="button" className={blogDraft.isPublished ? "is-on" : ""} onClick={() => setBlogDraft((current) => ({ ...current, isPublished: !current.isPublished }))} aria-label="Toggle publish state">
              <i className={blogDraft.isPublished ? "is-on" : ""} />
            </button>
          </div>
          <footer><button type="button" onClick={closeModal}>Cancel</button><button type="submit" className="la-primary-button">{isEditingBlog ? "Save blog" : "Publish blog"}</button></footer>
        </form>
      ) : null}

      {activeModal === "product" ? (
        <form className="la-product-drawer is-open" onSubmit={handleProductModalSubmit}>
          <header><div><p>{isEditing ? "Edit" : "New"}</p><h2>{isEditing ? productDraft.name || "Product" : "Add product"}</h2></div><button type="button" onClick={closeProductModal}>x</button></header>
          <div className="la-drawer-body">
            <label className="la-upload-card">Product image{productDraft.image ? <span><img src={productDraft.image} alt="" /></span> : <span><AdminIcon name="products" /></span>}<input type="file" accept="image/*" onChange={onProductUpload} /><small>PNG or JPG, 1:1 ratio recommended.</small></label>
            <div className="la-form-grid">
              <label>Product name<input value={productDraft.name} onChange={(event) => onProductDraftChange("name", event.target.value)} required /></label>
              <label>Price (NGN)<input type="number" min="0" step="1" value={productDraft.price} onChange={(event) => onProductDraftChange("price", event.target.value)} required /></label>
            </div>
            <label>Placement<div className="la-choice-grid">{[["category", "Top category"], ["bestseller", "Featured"]].map(([value, label]) => <button key={value} type="button" className={productDraft.section === value ? "is-active" : ""} onClick={() => onProductDraftChange("section", value)}>{label}</button>)}</div></label>
            <label>Availability<div className="la-choice-grid">{PRODUCT_AVAILABILITY_OPTIONS.map((option) => <button key={option.value} type="button" className={(productDraft.availability || "in_stock") === option.value ? "is-active" : ""} onClick={() => onProductDraftChange("availability", option.value)}>{option.label}</button>)}</div></label>
            {String(productDraft.availability || "in_stock") === "preorder" ? <label>Preorder note<input value={productDraft.preorderNote || ""} onChange={(event) => onProductDraftChange("preorderNote", event.target.value)} /></label> : null}
            <label>Audience tags<div className="la-audience-tags">{AUDIENCE_OPTIONS.map((option) => <button key={option.value} type="button" className={selectedAudiences.includes(option.value) ? "is-active" : ""} onClick={() => toggleAudienceSelection(option.value, !selectedAudiences.includes(option.value))}>{option.label}</button>)}</div></label>
            <label>Description<input value={productDraft.description} onChange={(event) => onProductDraftChange("description", event.target.value)} /></label>
            <label>Product detail bullets<textarea rows={4} value={productDraft.detailBulletsText || ""} onChange={(event) => onProductDraftChange("detailBulletsText", event.target.value)} /></label>
            <label>Fallback frame style<select value={productDraft.variant} onChange={(event) => onProductDraftChange("variant", event.target.value)}><option value="round">Round</option><option value="tortoise">Tortoise</option><option value="cat">Cat-Eye</option><option value="butterfly">Butterfly</option><option value="clear">Clear</option><option value="square">Square</option><option value="aviator">Aviator</option></select></label>
          </div>
          <footer><button type="button" onClick={closeProductModal}>Cancel</button><button type="submit" className="la-primary-button">{isEditing ? "Save changes" : "Create product"}</button></footer>
        </form>
      ) : null}

      {activeModal ? <button type="button" className="la-modal-backdrop" aria-label="Close modal" onClick={closeModal} /> : null}
      {adminToasts.length > 0 ? (
        <div className="la-toast-stack" aria-live="polite" aria-atomic="false">
          {adminToasts.map((toast) => (
            <div key={toast.id} className={`la-toast la-toast-${toast.tone}`}>
              <span>{toast.message}</span>
              <button type="button" onClick={() => dismissAdminToast(toast.id)} aria-label="Dismiss notification">
                x
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );


}

export default AdminOverlay;
