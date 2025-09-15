import React, { useState } from "react";
import styled, { css } from "styled-components";

// ❌ TypeScript component with multiple violation types
interface DashboardProps {
  user: {
    name: string;
    avatar?: string;
    role: "admin" | "user";
  };
  stats: {
    totalUsers: number;
    activeUsers: number;
    revenue: number;
  };
}

// ❌ Styled-components with theme violations
const DashboardContainer = styled.div`
  background: #f9fafb; /* Should use var(--dew-color-surface-hover) */
  min-height: 100vh;
  padding: 24px; /* Should use var(--dew-spacing-xl) */
`;

const Header = styled.header<{ isCollapsed: boolean }>`
  background: #ffffff; /* Should use var(--dew-color-surface) */
  border-bottom: 2px solid #e5e7eb; /* Should use var(--dew-color-border) */
  padding: 20px 32px; /* Should use var(--dew-spacing-lg) var(--dew-spacing-2xl) */
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06); /* Should use var(--dew-shadow-sm) */

  ${(props) =>
    props.isCollapsed &&
    css`
      padding: 12px 24px; /* Should use var(--dew-spacing-sm) var(--dew-spacing-xl) */
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); /* Should use var(--dew-shadow-xs) */
    `}
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 12px; /* Should use var(--dew-spacing-sm) */

  .avatar {
    width: 40px; /* Should use var(--dew-size-avatar-md) */
    height: 40px; /* Should use var(--dew-size-avatar-md) */
    border-radius: 50%;
    background: #6c5ce7; /* Should use var(--dew-color-brand-secondary) */
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff; /* Should use var(--dew-color-text-on-brand) */
    font-weight: 600;
    font-size: 16px; /* Should use var(--dew-text-base) */
  }

  .user-info {
    .name {
      color: #1a1a1a; /* Should use var(--dew-color-text-primary) */
      font-weight: 600;
      font-size: 16px; /* Should use var(--dew-text-base) */
      margin: 0;
    }

    .role {
      color: #6b7280; /* Should use var(--dew-color-text-secondary) */
      font-size: 14px; /* Should use var(--dew-text-sm) */
      margin: 0;
      text-transform: capitalize;
    }
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px; /* Should use var(--dew-spacing-lg) */
  margin: 32px 0; /* Should use var(--dew-spacing-2xl) 0 */
`;

const StatCard = styled.div<{ variant: "primary" | "success" | "warning" }>`
  background: #ffffff; /* Should use var(--dew-color-surface) */
  border: 1px solid #e5e7eb; /* Should use var(--dew-color-border) */
  border-radius: 12px; /* Should use var(--dew-radius-lg) */
  padding: 24px; /* Should use var(--dew-spacing-xl) */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); /* Should use var(--dew-shadow-sm) */
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* Should use var(--dew-shadow-md) */
    transform: translateY(-2px);
  }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 8px; /* Should use var(--dew-spacing-sm) */
    margin-bottom: 16px; /* Should use var(--dew-spacing-md) */

    .icon {
      width: 24px; /* Should use var(--dew-size-icon-md) */
      height: 24px; /* Should use var(--dew-size-icon-md) */
      border-radius: 6px; /* Should use var(--dew-radius-md) */
      display: flex;
      align-items: center;
      justify-content: center;

      ${(props) => {
        switch (props.variant) {
          case "primary":
            return css`
              background: #0066cc; /* Should use var(--dew-color-brand-primary) */
              color: #ffffff; /* Should use var(--dew-color-text-on-brand) */
            `;
          case "success":
            return css`
              background: #10b981; /* Should use var(--dew-color-success) */
              color: #ffffff; /* Should use var(--dew-color-text-on-success) */
            `;
          case "warning":
            return css`
              background: #f59e0b; /* Should use var(--dew-color-warning) */
              color: #ffffff; /* Should use var(--dew-color-text-on-warning) */
            `;
          default:
            return css`
              background: #6b7280; /* Should use var(--dew-color-neutral) */
              color: #ffffff; /* Should use var(--dew-color-text-on-neutral) */
            `;
        }
      }}
    }

    .title {
      color: #6b7280; /* Should use var(--dew-color-text-secondary) */
      font-size: 14px; /* Should use var(--dew-text-sm) */
      font-weight: 500;
      margin: 0;
    }
  }

  .stat-value {
    color: #1a1a1a; /* Should use var(--dew-color-text-primary) */
    font-size: 32px; /* Should use var(--dew-text-3xl) */
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
  }

  .stat-change {
    color: #10b981; /* Should use var(--dew-color-success) */
    font-size: 12px; /* Should use var(--dew-text-xs) */
    font-weight: 500;
    margin-top: 4px; /* Should use var(--dew-spacing-xs) */
  }
`;

const Dashboard: React.FC<DashboardProps> = ({ user, stats }) => {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // ❌ Inline styles with hardcoded values
  const actionButtonStyle = {
    backgroundColor: "#0066cc", // Should use var(--dew-color-brand-primary)
    color: "#ffffff", // Should use var(--dew-color-text-on-brand)
    border: "none",
    padding: "10px 20px", // Should use var(--dew-spacing-sm) var(--dew-spacing-lg)
    borderRadius: "6px", // Should use var(--dew-radius-md)
    fontSize: "14px", // Should use var(--dew-text-sm)
    cursor: "pointer",
    marginLeft: "8px", // Should use var(--dew-spacing-sm)
  };

  return (
    <DashboardContainer>
      <Header isCollapsed={isHeaderCollapsed}>
        <h1
          style={{
            color: "#1a1a1a", // Should use var(--dew-color-text-primary)
            fontSize: "24px", // Should use var(--dew-text-2xl)
            margin: 0,
          }}
        >
          Dashboard
        </h1>

        <div style={{ display: "flex", alignItems: "center" }}>
          <UserProfile>
            <div className="avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="user-info">
              <p className="name">{user.name}</p>
              <p className="role">{user.role}</p>
            </div>
          </UserProfile>

          <button
            style={actionButtonStyle}
            onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
          >
            Settings
          </button>
        </div>
      </Header>

      <StatsGrid>
        <StatCard variant="primary">
          <div className="stat-header">
            <div className="icon">👥</div>
            <h3 className="title">Total Users</h3>
          </div>
          <p className="stat-value">{stats.totalUsers.toLocaleString()}</p>
          <p className="stat-change">+12% from last month</p>
        </StatCard>

        <StatCard variant="success">
          <div className="stat-header">
            <div className="icon">⚡</div>
            <h3 className="title">Active Users</h3>
          </div>
          <p className="stat-value">{stats.activeUsers.toLocaleString()}</p>
          <p className="stat-change">+8% from last month</p>
        </StatCard>

        <StatCard variant="warning">
          <div className="stat-header">
            <div className="icon">💰</div>
            <h3 className="title">Revenue</h3>
          </div>
          <p className="stat-value">${stats.revenue.toLocaleString()}</p>
          <p className="stat-change">+15% from last month</p>
        </StatCard>
      </StatsGrid>

      {/* ❌ More inline styles and className violations */}
      <div
        className="bg-white border border-gray-200 rounded-lg p-6"
        style={{
          marginTop: "24px", // Should use var(--dew-spacing-xl)
          backgroundColor: "#ffffff", // Should use var(--dew-color-surface) - redundant with className
          borderColor: "#e5e7eb", // Should use var(--dew-color-border) - redundant with className
        }}
      >
        <h2
          style={{
            color: "#1a1a1a", // Should use var(--dew-color-text-primary)
            fontSize: "20px", // Should use var(--dew-text-xl)
            marginBottom: "16px", // Should use var(--dew-spacing-md)
          }}
        >
          Recent Activity
        </h2>

        <div className="text-gray-600 text-sm">
          No recent activity to display.
        </div>
      </div>
    </DashboardContainer>
  );
};

export default Dashboard;

