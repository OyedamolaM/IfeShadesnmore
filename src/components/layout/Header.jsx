import SearchIcon from "../icons/SearchIcon";

function Header({ brandName, onOpenAdmin }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand" onDoubleClick={onOpenAdmin}>
          {brandName}
        </div>
        <nav aria-label="Primary navigation">
          <a className="active" href="#home">
            Home
          </a>
          <a href="#shop">Shop</a>
          <a href="#about">About</a>
          <a href="#contact">Contact &middot;</a>
        </nav>
        <div className="header-actions">
          <button type="button" aria-label="Search">
            <SearchIcon />
          </button>
          <button type="button" aria-label="Quick search">
            <SearchIcon />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
