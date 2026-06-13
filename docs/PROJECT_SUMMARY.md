# ARIA (Agentic Real-estate Intelligence Advisor) Mentor Meeting Summary

Prepared: 2026-06-12  
Project: IE Business School x KPMG (Klynveld Peat Marwick Goerdeler) Spain Corporate Capstone 2026  
Live demo: https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/

Companion preparation file: [MENTOR_DEFENSE_QA.md](MENTOR_DEFENSE_QA.md)  
Use the companion file for detailed "why did we choose this model, this target, these columns, and these thresholds?" answers.

## 1. Purpose of This Document

This file is a meeting-preparation summary for the mentor discussion. It is written for the whole team. The goal is to explain what has been completed, why each part matters, what evidence we can show, and what questions we should ask next.

The project is called ARIA (Agentic Real-estate Intelligence Advisor). ARIA is designed as an artificial intelligence (AI) advisory platform for short-term rental decision-making. In simple terms, it takes Airbnb-style listing data, applies machine learning models, explains the outputs, and presents the results through an interactive product demo.

The project is not only a set of notebooks. It now has three layers:

1. A data layer: cleaned and engineered short-term rental data for Paris and Athens.
2. A model layer: pricing prediction and host risk models with explanation outputs.
3. A product layer: a deployed web demo that shows how the agents could work for users.

## 2. Executive Snapshot

What we have completed so far:

- We built a master analytical dataset with 135,051 listings and 96 columns across Paris and Athens.
- We completed Phase 1, exploratory data analysis (EDA), which means we inspected the data, documented data quality issues, made engineering decisions, created figures, and translated raw data into modelling-ready features.
- We completed Phase 2, XGBoost (Extreme Gradient Boosting) pricing models, for Paris and Athens. These models estimate a fair nightly price for each listing.
- We completed Phase 3, LightGBM (Light Gradient Boosting Machine) host risk modelling, for Athens. This model estimates whether a listing or host is showing signs of business risk.
- We generated explanation files using SHAP (Shapley Additive Explanations), which show which features pushed model predictions up or down.
- We created a professional Phase 7 web demo using Vite React and deployed it on Vercel.
- We created plans and folder scaffolding for Phase 5, retrieval-augmented generation (RAG) compliance, and Phase 6, LangGraph agent orchestration.

The strongest result to discuss with the mentor:

> The Athens market now has a validated opportunity pipeline. We identified 2,945 underpriced listings, 4,695 high-risk listings, and 865 listings that are both underpriced and high-risk. This overlap is the clearest current business output because it points to listings where pricing improvement and host risk intervention matter at the same time.

Why this matters:

- For a host or property manager, ARIA can explain where revenue may be left on the table.
- For an investor, ARIA can help rank neighbourhoods and identify market opportunity.
- For KPMG advisors, ARIA can become a prototype for an explainable artificial intelligence (AI) advisory tool that combines data science, regulation, and decision support.

## 3. Simple Project Pitch

ARIA (Agentic Real-estate Intelligence Advisor) helps answer questions such as:

- Is this short-term rental listing priced correctly?
- Which listings are underpriced compared with similar listings nearby?
- Which hosts or listings are showing signs of declining performance?
- Which neighbourhoods look attractive for real-estate investment?
- Which listings may have regulatory or compliance concerns?
- How can machine learning outputs be turned into clear business recommendations?

The current version proves three important foundations:

1. We can build a defensible data foundation from multiple public sources.
2. We can train explainable machine learning models that produce useful business signals.
3. We can present the system as a professional artificial intelligence (AI) product through a deployed web interface.

## 4. Data Foundation Completed

The first major achievement is the data foundation. This matters because every model and agent depends on the quality of the dataset.

Master dataset:

- Total size: 135,051 listings and 96 columns.
- Paris: 120,809 listings.
- Athens: 14,242 listings.
- The dataset combines historical and current data sources.

Main data sources:

| Source | City | Why it matters |
|---|---|---|
| Maven Analytics Paris 2021 | Paris | Gives a large Paris dataset with observed prices and host/listing attributes |
| Inside Airbnb Paris September 2025 | Paris | Gives a more current view of Paris listings, demand, availability, and host behaviour |
| Inside Airbnb Athens September 2025 | Athens | Gives current Athens listings, prices, licenses, reviews, and availability |
| Kaggle / Zenodo spatial dataset | Paris and Athens enrichment | Adds location-related variables such as distance and neighbourhood context |

Important data engineering work completed:

- Different source files used different encodings, so we fixed loading issues before analysis.
- Boolean columns, such as true/false fields, appeared in different formats across sources, so we standardised them.
- Price fields appeared in different formats and units, so we normalised them before modelling.
- We created `log_price`, a transformed price column, because short-term rental prices are heavily skewed. This helps the pricing model learn more stable patterns.
- We calculated distance from each listing to the city centre using the Haversine formula, which measures geographic distance from latitude and longitude.
- We created distance zones, such as centre, mid, outer, and far, because location has a strong effect on price.
- We rebuilt `review_score_composite` onto a comparable 0 to 10 scale, because Paris and Athens review scores came from different source formats.
- We created `at_risk_host`, a transparent host-risk label, because public Airbnb data does not contain an official churn or failure label.
- We ran VADER (Valence Aware Dictionary and sEntiment Reasoner) sentiment scoring on 594,482 reviews and documented the language limitation for French Paris reviews.
- We created model-routing flags so each model only uses rows that are appropriate for that task.

Important routing flags:

| Column | Plain-language meaning |
|---|---|
| `price_eur_estimated` | Marks listings where the price was estimated rather than observed directly |
| `xgb_price_training_eligible` | Marks rows that are safe to use for the XGBoost (Extreme Gradient Boosting) pricing model |
| `prophet_training_eligible` | Marks rows that are suitable for Prophet time-series forecasting |
| `sentiment_city_comparable` | Marks rows where sentiment is reliable for cross-city comparison |

Key data findings:

- Athens has a much stronger distance-to-centre price effect than Paris, which supports using separate city models.
- Paris pricing needs to be discussed carefully because part of the Paris data comes from 2021 and part of the 2025 Paris price field had to be estimated.
- Athens is the strongest current market for actionable recommendations because it has current prices, licenses, availability, reviews, and risk labels.
- We identified 137 unlicensed Athens listings, which can become the main target group for the future retrieval-augmented generation (RAG) compliance agent.
- Neighbourhood context is one of the most important signals for both pricing and investment recommendations.

Evidence files to show:

- `eda/ARIA_EDA_v4_FINAL.ipynb`
- `eda/eda_figures/`
- `data/outputs/`

## 5. Phase 1: Exploratory Data Analysis Completed

Phase 1 was not just a visual exploration. It became the foundation for the whole project.

What exploratory data analysis (EDA) means here:

- We checked what data exists and where it comes from.
- We inspected missing values, price distributions, location effects, host quality signals, market dynamics, and sentiment.
- We documented limitations instead of hiding them.
- We created modelling decisions from the data rather than guessing.

Main outputs:

- A final notebook: `eda/ARIA_EDA_v4_FINAL.ipynb`.
- A full set of figures in `eda/eda_figures/`.
- A documented explanation of the data pipeline and accepted limitations.
- Feature engineering decisions that feed directly into Phase 2 and Phase 3.

Why this matters for the mentor:

The project has a defensible methodology. If the mentor asks why we made a modelling choice, such as using separate city models or using a transformed price target, we can trace the answer back to the exploratory analysis.

## 6. Phase 2: XGBoost Pricing Models Completed

Goal:

Predict a fair nightly price for each listing, then detect listings where the actual price is lower than the model-estimated fair price.

Plain-language explanation:

The XGBoost (Extreme Gradient Boosting) model learns patterns from listings with known prices. It looks at features such as neighbourhood, distance to centre, room type, capacity, bedrooms, review score, availability, and host behaviour. After training, it predicts what a fair price should be. If the predicted fair price is much higher than the actual price, the listing may be underpriced.

What was built:

- One XGBoost (Extreme Gradient Boosting) pricing model for Paris.
- One XGBoost (Extreme Gradient Boosting) pricing model for Athens.
- A 26-feature modelling pipeline.
- Optuna hyperparameter tuning, which means the computer searched for better model settings across 100 trials.
- A holdout evaluation, meaning we tested the model on data it did not use during training.
- SHAP (Shapley Additive Explanations) outputs so predictions can be explained.
- An Athens underpricing output file for the host intelligence workflow.

Model performance:

| City | R squared (coefficient of determination) | Mean absolute error | Interpretation |
|---|---:|---:|---|
| Paris | 0.588 | 29.1 euro | Useful, but should be presented cautiously because Paris pricing data is partly older or estimated |
| Athens | 0.676 | 29.1 euro | Stronger current-market result and the main actionable pricing model |

How to explain these metrics:

- R squared (coefficient of determination) tells us how much of the price variation the model explains. Higher is better.
- Mean absolute error tells us the average size of the model's pricing mistake in euros. Lower is better.
- The Athens model is more actionable because the Athens data is more current and complete for the project use case.

Business output:

- 2,945 Athens listings are underpriced by more than 15 euro.
- Estimated annual foregone revenue is about 4.8 million euro.
- SHAP (Shapley Additive Explanations) confirms that local market context is the strongest pricing driver.
- Paris pricing appears more driven by size and capacity.
- Athens pricing appears more driven by quality, location, and demand signals.

Evidence files:

- `eda/ARIA_XGBoost_v1.ipynb`
- `models/xgb_paris_v1.json`
- `models/xgb_athens_v1.json`
- `data/outputs/paris_predictions_v1.csv`
- `data/outputs/athens_predictions_v1.csv`
- `data/outputs/athens_underpricing_v1.csv`
- `data/outputs/shap_paris_v1.csv`
- `data/outputs/shap_athens_v1.csv`

## 7. Phase 3: LightGBM Host Risk Model Completed

Goal:

Estimate which Athens listings or hosts show signs of risk, such as weak demand, low recent booking momentum, quality issues, or excessive availability.

Plain-language explanation:

The LightGBM (Light Gradient Boosting Machine) model does not predict price. It predicts risk. It gives each Athens listing a risk probability from 0 to 1. A higher score means the listing looks more vulnerable based on observable signals in the data.

What was built:

- A LightGBM (Light Gradient Boosting Machine) classifier for Athens.
- A transparent target label called `at_risk_host`.
- A leakage audit and correction.
- Optuna hyperparameter tuning.
- Cross-validation, which means the model was tested across several splits of the data to check stability.
- A risk probability output for every Athens listing.
- SHAP (Shapley Additive Explanations) and feature importance outputs for explainability.

Important governance point:

An earlier version of the model produced an unrealistically high Area Under the Receiver Operating Characteristic Curve score of 0.9995. That was a warning sign. The team inspected the model explanations and discovered data leakage, meaning the model had access to variables that were too closely related to the target label. Those leaking features were removed. The corrected model has an honest Area Under the Receiver Operating Characteristic Curve score of 0.8288.

This is important for a KPMG-style discussion because it shows Trusted artificial intelligence (AI) discipline. The team did not accept an unrealistic model just because the metric looked impressive.

Performance:

| Metric | Value | Target | Result |
|---|---:|---:|---|
| Area Under the Receiver Operating Characteristic Curve | 0.8288 | Greater than 0.72 | Passed |
| Average precision | 0.8864 | Greater than 0.65 | Passed |
| Brier score | 0.1656 | Less than 0.25 | Passed |
| Cross-validation stability | plus/minus 0.0088 | Less than plus/minus 0.02 | Stable |

How to explain these metrics:

- Area Under the Receiver Operating Characteristic Curve measures how well the model separates high-risk and low-risk cases.
- Average precision is useful when we care about correctly identifying the risky listings.
- Brier score measures probability calibration. In plain English, it checks whether predicted probabilities behave like real probabilities.
- Cross-validation stability tells us whether the model performs consistently across different slices of data.

Business output verified from current files:

- 14,242 Athens listings have risk scores.
- 4,695 listings are high-risk.
- 6,137 listings are low-risk.
- 3,410 listings are moderate-risk.
- 865 listings are both underpriced and high-risk.
- Estimated opportunity is 1.43 million euro potential, or about 0.71 million euro if only 50 percent of the pricing gap is realistically captured.

Evidence files:

- `eda/ARIA_LightGBM_v1.ipynb`
- `models/lgb_athens_risk_v1.txt`
- `data/outputs/athens_risk_scores_v1.csv`

## 8. The Most Important Combined Finding

The strongest current insight is not only that some listings are underpriced, and not only that some listings are risky. The strongest insight is the overlap between the two.

Current Athens overlap:

- 2,945 listings are underpriced.
- 4,695 listings are high-risk.
- 865 listings are both underpriced and high-risk.

Why the overlap matters:

- An underpriced listing alone suggests revenue opportunity.
- A high-risk listing alone suggests performance or retention concern.
- A listing that is both underpriced and high-risk is much more actionable. It may need immediate pricing, quality, or demand recovery intervention.

How to explain it to the mentor:

> The overlap of 865 listings is our best current business target. These listings are likely leaving revenue on the table while also showing signs of weakness. ARIA can use this group to produce practical host recommendations, such as adjusting price, improving listing quality, or rebuilding booking momentum.

## 9. Phase 7: User Interface Demo Completed and Deployed

Goal:

Turn the analytical work into a professional interactive demo that feels like a real artificial intelligence (AI) product, not only a notebook.

What was built:

- A Vite React web application deployed on Vercel.
- A ChatGPT-style interface for ARIA (Agentic Real-estate Intelligence Advisor).
- A sidebar with conversations, settings, theme selector, model selector, and photo upload support.
- A landing page with the ARIA wordmark, portfolio summary cards, agent signals, and live data status.
- A composer where users can type prompts and upload photos from their desktop.
- A fullscreen control and polished layout.
- Multiple visual themes, including Airbnb-style, KPMG-style, and dark mode.

The five proposed agent personas shown in the demo:

| Agent | Plain-language purpose |
|---|---|
| Host Revenue Intelligence | Helps hosts understand pricing, occupancy, and underpricing gaps |
| Gentrification Early Warning | Shows potential neighbourhood displacement and social-impact signals |
| Short-Term Rental Financial Crime Detection | Demonstrates anomaly and anti-money-laundering style risk analysis |
| Tourism Demand Forecast | Shows demand, occupancy, and infrastructure load forecasting concepts |
| Market Entry Advisor | Helps investors compare neighbourhood entry opportunities |

Demo behaviour:

- In demo mode, the application uses scripted, project-grounded responses. This makes the presentation reliable and ensures the numbers match the project story.
- In live Gemini mode, the application can send questions to a Gemini model if a Google Gemini application programming interface (API) key is provided.
- The user interface (UI) currently demonstrates the intended agentic workflow. It is not yet a full production backend connected to every model and data file.

Live deployment:

- https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/

Technical structure:

| Component | Location |
|---|---|
| Vite React application | `Stage 7 - UI Interface/vercel_vite_app/` |
| Root Vercel deployment configuration | `vercel.json` |
| Original design prototype | `Stage 7 - UI Interface/prototype/` |
| Streamlit wrapper | `Stage 7 - UI Interface/streamlit_app/app.py` |

Important caveat:

The current deployed demo is a polished front-end and stakeholder presentation tool. The next major engineering step is to connect real model outputs, Prophet forecasting, retrieval-augmented generation (RAG) compliance, and LangGraph orchestration into the backend.

## 10. Current Phase Status

| Phase | Status | What exists now | What to discuss with mentor |
|---|---|---|---|
| Phase 1: Exploratory data analysis | Complete | Final notebook, figures, data quality decisions, feature engineering decisions | Confirm that the methodology and limitations are framed clearly enough |
| Phase 2: XGBoost (Extreme Gradient Boosting) pricing | Complete | Trained pricing models, prediction files, Shapley Additive Explanations files, underpricing file | Confirm whether the 15 euro underpricing threshold is defensible |
| Phase 3: LightGBM (Light Gradient Boosting Machine) risk | Complete | Trained risk model, risk scores, leakage correction story | Use this as a Trusted artificial intelligence (AI) example |
| Phase 4: Prophet forecasting | Next analytical phase | Planned, but no final output yet | Ask whether forecasting should be at city, distance-zone, or neighbourhood level |
| Phase 5: Retrieval-augmented generation compliance | Planned and scaffolded | Folder and README plan exist; 137 unlicensed Athens listings are identified | Ask how detailed the legal/regulatory retrieval needs to be |
| Phase 6: LangGraph orchestration | Planned and scaffolded | Folder and README plan exist for a five-agent graph | Ask whether to build a real backend or a thinner demo orchestration |
| Phase 7: User interface demo | Demo built and deployed | Vite React app on Vercel, Streamlit wrapper, prototype screenshots | Ask how much more time should go into polish versus backend integration |
| Documentation and presentation | Still needed | Some supporting documents exist, final deck is not complete | Align the final project story before building slides |

## 11. Suggested Meeting Flow

Use this structure if the meeting is 15 to 20 minutes.

1. Project objective, 1 minute:
   - Explain that ARIA (Agentic Real-estate Intelligence Advisor) turns short-term rental data into explainable investment, host, and compliance recommendations.

2. Data foundation, 3 minutes:
   - Explain the 135,051-listing dataset.
   - Explain why Paris and Athens are treated differently.
   - Explain that limitations are documented and managed through routing flags.

3. Completed modelling work, 5 minutes:
   - Pricing model: show that XGBoost (Extreme Gradient Boosting) predicts fair price and identifies 2,945 underpriced Athens listings.
   - Risk model: show that LightGBM (Light Gradient Boosting Machine) predicts risk and produces 4,695 high-risk listings.
   - Combined insight: show the 865-listing overlap as the main business target.

4. User interface demo, 4 minutes:
   - Open the Vercel link.
   - Show the landing page.
   - Open Host Revenue Intelligence.
   - Ask one of the scripted questions about underpricing or revenue simulation.
   - Explain clearly that this is currently a polished demo with planned backend integration.

5. Remaining work and mentor questions, 5 minutes:
   - Ask about Prophet forecasting scope.
   - Ask about retrieval-augmented generation (RAG) compliance depth.
   - Ask about LangGraph backend expectations.
   - Ask what the final presentation should emphasise.

## 12. Questions to Ask the Mentor

High-priority questions:

1. Should we prioritise Phase 4, Prophet forecasting, or is the current pricing and risk evidence strong enough to move into agent integration?
2. For Phase 5, retrieval-augmented generation (RAG) compliance, should the agent only cite regulations, or should it also produce a business action recommendation?
3. How much real backend functionality is expected behind the final demo?
4. Should the final presentation focus mainly on Athens because Athens has the strongest current pricing, risk, and compliance evidence?
5. Is the 865-listing priority cohort the right hero output for the final presentation?

Methodology questions:

1. Is the `at_risk_host` heuristic label acceptable if we clearly explain that public data does not contain true host churn outcomes?
2. Is 15 euro an appropriate underpricing threshold, or should we use a higher threshold, such as 25 euro or 40 euro, for higher-confidence recommendations?
3. Should Paris results be presented more cautiously because Maven Paris is from 2021 and Inside Airbnb Paris 2025 had estimated prices?
4. Should the final deck include the leakage correction story as an example of Trusted artificial intelligence (AI) governance?

Product questions:

1. Should ARIA (Agentic Real-estate Intelligence Advisor) be framed mainly as a KPMG advisory accelerator, a host revenue tool, or a regulator and investor intelligence platform?
2. Should we keep all five agents in the final story, or simplify around the strongest two agents: Host Revenue Intelligence and Market Entry Advisor?
3. Should the deployed user interface (UI) stay as a polished simulation, or should we spend the next sprint wiring one real backend workflow into it?

## 13. Known Risks and How to Explain Them

| Risk | Clear explanation for nontechnical listeners |
|---|---|
| Paris pricing data is partly old or estimated | We disclose this clearly. We do not train the pricing model on estimated Paris 2025 prices. We use routing flags to prevent inappropriate rows from entering the model. |
| There is no true public churn label for hosts | We created a transparent proxy label based on observable risk behaviours. It is not perfect, but it is explainable and useful for prioritisation. |
| Prophet forecasting is not complete yet | The data foundation already marks rows eligible for forecasting. This is the next analytical phase. |
| Retrieval-augmented generation (RAG) compliance is not implemented yet | The target group is already identified: 137 unlicensed Athens listings. The next step is building the regulation retrieval layer. |
| The deployed user interface (UI) currently uses scripted demo outputs | This is intentional for presentation reliability. The demo shows the intended product experience while backend integration remains the next engineering step. |
| Large data files and Git Large File Storage complexity | The important model output files are present locally. Large raw and processed data files need careful handling outside normal small-file Git workflows. |

## 14. Best Evidence to Show

If the mentor has limited time, show these items.

1. Live demo:
   - https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/

2. Core notebooks:
   - `eda/ARIA_EDA_v4_FINAL.ipynb`
   - `eda/ARIA_XGBoost_v1.ipynb`
   - `eda/ARIA_LightGBM_v1.ipynb`

3. Core comma-separated values (CSV) model outputs:
   - `data/outputs/athens_underpricing_v1.csv`
   - `data/outputs/athens_risk_scores_v1.csv`
   - `data/outputs/shap_athens_v1.csv`

4. Core model files:
   - `models/xgb_athens_v1.json`
   - `models/xgb_paris_v1.json`
   - `models/lgb_athens_risk_v1.txt`

5. Visual evidence:
   - `eda/eda_figures/`
   - `Stage 7 - UI Interface/prototype/screenshots/`

## 15. Recommended Next Sprint

Recommended order:

1. Complete Phase 4, Prophet forecasting, at neighbourhood or distance-zone level.
2. Build a small Phase 5 retrieval-augmented generation (RAG) compliance proof of concept for the 137 unlicensed Athens listings.
3. Build a lightweight Phase 6 LangGraph orchestrator using existing pricing and risk output files first.
4. Connect one real backend workflow into the Vercel demo, preferably Host Revenue Intelligence for one listing or one neighbourhood.
5. Prepare the final presentation around one coherent story:
   - Data foundation.
   - Pricing model.
   - Risk model.
   - Priority cohort.
   - Agentic recommendation.
   - Polished demo.

Suggested final hero narrative:

> ARIA (Agentic Real-estate Intelligence Advisor) identifies short-term rental listings that are both underpriced and vulnerable, then turns explainable machine learning outputs into an advisory-ready recommendation. The best current proof is Athens: 2,945 underpriced listings, 4,695 high-risk listings, and 865 priority listings where both signals overlap.
