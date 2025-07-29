---

## 🔐 GitHub Pull Request Workflow (with Approvals)

When working on a protected `main` branch, all changes must go through a Pull Request (PR).  
This workflow also works for **solo developers** (self-approval).

---

### 1️⃣ Create a Pull Request

1. Push your branch to GitHub.
2. Go to your repository and click **Compare & pull request** (if GitHub shows a banner)  
   _OR_ click **Pull Requests** → **New pull request**.
3. Choose:
   - **base:** `main`
   - **compare:** your feature branch
4. Add a title and description → click the green **Create pull request** button.

![Create PR](./screenshots/create-pr.png)

---

### 2️⃣ Assign Yourself as Reviewer (Solo Developer)

Once the PR is created:
1. You’ll be redirected to the PR page.
2. On the right-hand side, under **Reviewers**, click **Assign yourself**.

![Assign Yourself](./screenshots/assign-yourself.png)

---

### 3️⃣ Review and Approve the PR

1. Go to the **Files changed** tab.
2. Click the **Review changes** button (top right).
3. Select **Approve** and click **Submit review**.

![Approve PR](./screenshots/approve-pr.png)

---

### 4️⃣ Merge the PR

1. Go back to the **Conversation** tab.
2. Click the green **Merge pull request** button.
3. This will trigger the Render deployment (since we locked deploys to `main`).

![Merge PR](./screenshots/merge-pr.png)

---

### 🔄 Resetting if Something Goes Wrong
If you get stuck:
1. Delete your local branch and re-pull `main`:
   ```bash
   git checkout main
   git pull origin main
   git branch -D <your-feature-branch>
