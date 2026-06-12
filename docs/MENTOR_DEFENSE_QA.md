# ARIA (Agentic Real-estate Intelligence Advisor) Mentor Defense Question and Answer Guide

Prepared: 2026-06-12  
Purpose: Help the team answer mentor questions about why specific models, columns, targets, thresholds, and design choices were used.

This file is intentionally detailed. It is written for a mixed team, including people who are not deeply technical. When a technical term is needed, the full name is provided beside it.

## 1. How to Use This File

Use this as a rehearsal guide. The mentor may not ask the questions exactly as written, but the logic behind the answers should prepare the team.

The safest answer structure is:

1. State the business reason.
2. State the data reason.
3. State the modelling reason.
4. State the limitation honestly.
5. State what we would improve next.

Example:

> We used separate Paris and Athens pricing models because the business markets behave differently, the exploratory data analysis showed different location-price patterns, and the Shapley Additive Explanations confirmed different drivers after modelling. The limitation is that Paris pricing data is older and partly estimated, so Athens is our stronger current-market proof.

## 2. The Core Project Logic

The project is built around one idea:

> Short-term rental decisions should not be based only on raw price or occupancy. They should combine pricing opportunity, host risk, geography, regulation, and explainability.

That is why the system has multiple parts:

- Exploratory data analysis: to understand the data and justify modelling choices.
- XGBoost (Extreme Gradient Boosting): to predict fair nightly price.
- LightGBM (Light Gradient Boosting Machine): to estimate host and listing risk.
- SHAP (Shapley Additive Explanations): to explain model outputs.
- Vite React web demo: to show the product experience.
- Future Prophet forecasting: to add demand forecast.
- Future retrieval-augmented generation (RAG): to connect listings to legal/regulatory text.
- Future LangGraph orchestration: to route a user question across specialist agents.

## 3. Questions About the Data Sources

### Q1. Why did we combine several data sources instead of using one clean dataset?

Short answer:

No single public dataset had everything needed for the project.

Detailed answer:

The project needed prices, locations, reviews, availability, host behaviour, licence information, and neighbourhood context. Each source contributed a different piece:

- Maven Analytics Paris 2021 gave a large Paris dataset with observed prices and rich listing information.
- Inside Airbnb Athens September 2025 gave current Athens prices, reviews, licence information, availability, and calendar-derived signals.
- Inside Airbnb Paris September 2025 gave current Paris demand and host behaviour signals, but not reliable observed prices.
- Kaggle / Zenodo spatial data added location and neighbourhood proximity features.

This combination allowed the project to support pricing, risk, compliance, and demand questions. A single-source approach would have been simpler but weaker.

### Q2. Why is Athens so important if it is only 14,242 rows out of 135,051?

Short answer:

Athens is smaller by row count but richer for current decision-making.

Detailed answer:

Athens has current September 2025 data, observed prices, licence information, review text, availability, and calendar-derived signals. This makes Athens the strongest city for actionable modelling. It is the only city where the current project can fully connect pricing, host risk, and compliance.

Paris has more rows, but part of the Paris data comes from 2021 and part of the 2025 Paris price field had to be estimated. That makes Paris valuable for broader market comparison, but Athens is the cleaner proof of concept for the final advisory story.

### Q3. Why did we keep Paris if Athens is stronger?

Short answer:

Paris expands the project scope and proves the framework can work across markets, but we present its pricing results carefully.

Detailed answer:

Paris helps show that ARIA (Agentic Real-estate Intelligence Advisor) is not a single-city tool. It also provides a large training base for a pricing model. However, because the Maven Paris data is from 2021 and the Inside Airbnb Paris 2025 prices were estimated, Paris is less current than Athens for pricing. We use Paris as a useful comparison market, while using Athens as the main current-market business proof.

## 4. Questions About Exploratory Data Analysis

### Q4. Why did we spend so much time on exploratory data analysis?

Short answer:

Because the data had many source differences and the modelling choices needed to be defensible.

Detailed answer:

Exploratory data analysis is where we discovered:

- Which rows had observed prices versus estimated prices.
- Which cities had reliable price, demand, review, and licence signals.
- Why Paris and Athens needed separate pricing models.
- Why `log_price` should be used as the pricing target.
- Which columns could cause data leakage.
- Which signals should feed pricing versus risk versus forecasting.

Without exploratory data analysis, the project would risk training models on mixed-quality rows or using columns that accidentally reveal the answer.

### Q5. What were the most important exploratory data analysis findings?

The most important findings were:

- Athens has a much stronger distance-to-centre price effect than Paris.
- Paris pricing should be presented cautiously because part of the source data is older or estimated.
- Neighbourhood context strongly affects pricing.
- Review velocity and review quality are strong indicators of host risk.
- Athens licence information creates a future compliance use case.
- Sentiment comparison across cities is limited because VADER (Valence Aware Dictionary and sEntiment Reasoner) is less reliable on French text.

## 5. Questions About the XGBoost Pricing Model

### Q6. Why did we choose XGBoost (Extreme Gradient Boosting) for price prediction?

Short answer:

XGBoost (Extreme Gradient Boosting) is strong for tabular data with nonlinear relationships and interactions.

Detailed answer:

Short-term rental pricing is not linear. A listing's price depends on combinations of factors:

- A two-bedroom entire home in a central neighbourhood behaves differently from a private room far from the centre.
- Distance matters much more in Athens than in Paris.
- A high review score may matter differently depending on location and room type.
- Neighbourhood median price creates local market context.

XGBoost (Extreme Gradient Boosting) is a tree-based model that captures these nonlinear effects and interactions without requiring us to manually specify every possible relationship. It also works well on structured tabular datasets like this one.

Why not linear regression?

- Linear regression assumes a much simpler relationship.
- It would struggle with nonlinear distance effects, interaction effects, and neighbourhood context.
- It would be easier to explain but less accurate for this type of pricing problem.

Why not a neural network?

- A neural network would be harder to explain.
- It would require more tuning and more data discipline.
- It would be less suitable for a KPMG-style explainability story.

Why not only random forest?

- Random forest is useful but can be less efficient for tuned prediction performance.
- XGBoost (Extreme Gradient Boosting) gives stronger control over regularisation, learning rate, and boosting iterations.
- XGBoost (Extreme Gradient Boosting) is widely used for high-performing tabular prediction tasks.

### Q7. Why did we predict `log_price` instead of raw price?

Short answer:

Short-term rental prices are heavily skewed, so `log_price` makes the target easier and fairer for the model to learn.

Detailed answer:

Most listings are in a normal price range, but some are very expensive. If the model trains directly on raw price, expensive outliers dominate the error. By using `log_price`, large price differences are compressed. This helps the model learn patterns across the full market instead of focusing too heavily on luxury outliers.

After prediction, the result is transformed back into euros so the business output is still understandable.

Mentor-ready phrasing:

> We modelled log-transformed price for statistical stability, then converted predictions back into euros for interpretation.

### Q8. Why did we train separate Paris and Athens pricing models?

Short answer:

The markets behave differently.

Detailed answer:

The exploratory data analysis showed that Athens has a much stronger location effect. Listings near Syntagma Square and the Acropolis have a strong price premium. Paris has a flatter and more complex geography because tourist demand is spread across several areas.

The SHAP (Shapley Additive Explanations) results confirmed this difference:

- Paris pricing is more size and capacity driven.
- Athens pricing is more quality, location, and demand-signal driven.
- Neighbourhood median price is important in both cities, but the next most important drivers differ.

One combined model would blur these differences and produce less useful recommendations.

### Q9. Why did we only train XGBoost (Extreme Gradient Boosting) on `xgb_price_training_eligible = 1` rows?

Short answer:

We only wanted observed prices in the pricing model.

Detailed answer:

Inside Airbnb Paris September 2025 had blank price fields. Those prices were estimated using comparable listings. Estimated prices are useful for descriptive context, but they should not be used as training labels for a pricing model. Training on estimated prices would teach the model the estimation method rather than the real market.

The `xgb_price_training_eligible` flag protects the model by allowing only rows with observed prices into training.

### Q10. Why were the XGBoost (Extreme Gradient Boosting) columns chosen?

Short answer:

The columns represent the main economic drivers of short-term rental price: size, location, neighbourhood market, host quality, demand, and interactions between them.

Detailed answer:

The final XGBoost (Extreme Gradient Boosting) feature set has 26 columns. They can be grouped into six business categories.

#### Physical listing characteristics

| Column | Why it was included |
|---|---|
| `person_capacity` | Larger capacity usually supports a higher nightly price. |
| `bedrooms` | More bedrooms usually indicate a larger property and a higher price. |
| `amenity_count` | More amenities can increase perceived quality and price. |
| `room_type_encoded` | Entire homes, private rooms, shared rooms, and hotel rooms have different price levels. |
| `capacity_x_dist` | Capacity matters differently depending on distance from the centre. |
| `bedrooms_x_amenity` | A large property with many amenities has a different value profile from a large but basic property. |
| `room_x_capacity` | Room type and capacity interact strongly, especially for entire homes. |
| `amenity_per_bedroom` | Measures how well-equipped the property is relative to its size. |

#### Location and geography

| Column | Why it was included |
|---|---|
| `dist_km` | Distance to the city centre affects tourist demand and price. |
| `dist_km_sq` | Captures nonlinear distance decay, especially in Athens. |
| `log_dist_km` | Captures a softer log-shaped distance relationship. |
| `inv_dist_km` | Amplifies the central-location premium. |
| `kaggle_median_lifestyle` | Adds zone-level attraction, restaurant, and lifestyle context. |
| `kaggle_median_metro_dist_km` | Adds zone-level transit accessibility context. |
| `dist_x_score` | Combines location and quality; a high-quality central listing behaves differently from a low-quality distant one. |

#### Host quality and professionalism

| Column | Why it was included |
|---|---|
| `host_multi_listing` | Multi-listing hosts may behave more professionally or commercially. |
| `is_superhost_int` | Superhost status is a platform quality signal. |
| `host_tenure_days` | More experienced hosts may price differently and operate differently. |
| `host_response_rate_num` | Faster response behaviour can support stronger conversion and pricing power. |
| `host_acceptance_rate_num` | Acceptance behaviour can signal demand management or host strategy. |
| `superhost_x_score` | Combines platform badge and guest review quality. |
| `tenure_x_multi` | Captures experienced professional operators versus newer casual hosts. |

#### Review and demand signals

| Column | Why it was included |
|---|---|
| `review_score_composite` | Guest quality ratings affect willingness to pay. |
| `review_velocity_l30d` | Recent reviews proxy recent bookings and current demand. |
| `availability_rate` | High availability can indicate low demand or strategic open inventory. |

#### Neighbourhood market context

| Column | Why it was included |
|---|---|
| `neighbourhood_median_price` | Gives the model a local market benchmark. A listing in a high-price neighbourhood should not be compared directly with one in a low-price neighbourhood. |

Important implementation note:

The current exported SHAP (Shapley Additive Explanations) file confirms `neighbourhood_median_price` as the final neighbourhood feature. Some older notebook text mentions `neighbourhood_target_encoded`, but the implemented final feature matrix uses `neighbourhood_median_price`. If asked, the clean answer is that neighbourhood median price is more interpretable, safer to explain, and directly aligned with the underpricing benchmark logic.

### Q11. Why did we include interaction columns?

Short answer:

Some features only make sense in combination.

Detailed answer:

For example, capacity alone is not enough. A high-capacity listing in the centre may command a very different premium than a high-capacity listing far from the centre. Similarly, room type and capacity together say more than either column alone. Interactions help the model capture real market patterns.

### Q12. Why use `neighbourhood_median_price`?

Short answer:

Because real-estate pricing is local.

Detailed answer:

A listing's fair price depends strongly on its neighbourhood. `neighbourhood_median_price` gives the model a market benchmark. This is also easy for nontechnical audiences to understand: a listing is evaluated against similar listings in its area, not against the whole city.

Possible mentor challenge:

> Is that leakage because it uses price?

Answer:

It is a market context feature, but it must be handled carefully. In the current project it is used as a neighbourhood-level benchmark from the modelling dataset. It is less risky than using the individual listing's own price directly. The model never uses `price_eur` or `log_price` as input features. For a production version, we would compute neighbourhood medians only from training data or from a historical benchmark table to remove any possible holdout contamination.

### Q13. Which columns were excluded from the XGBoost (Extreme Gradient Boosting) pricing model and why?

Excluded columns included:

| Column | Why it was excluded |
|---|---|
| `price_eur` | This is the raw target source. Including it would directly reveal the answer. |
| `log_price` | This is the transformed target. Including it would be direct leakage. |
| `price_eur_estimated` | This marks estimated prices and could teach the model source artefacts rather than market behaviour. |
| `xgb_price_training_eligible` | This is a routing flag, not a business driver of price. |
| `estimated_revenue_l365d` | Revenue is partly derived from price and occupancy, so it can leak target information. |

## 6. Questions About the XGBoost Training Method

### Q14. Why use an 80 percent training and 20 percent holdout split?

Short answer:

It keeps enough data for training while preserving an honest final test set.

Detailed answer:

The model trains on 80 percent of the data. The remaining 20 percent is locked away and used only for final evaluation. This prevents the team from repeatedly tuning the model on the same examples used to judge performance.

### Q15. Why was Paris stratified by distance zone, while Athens used a random split?

Short answer:

Paris needed distance-zone balance. Athens had too few far-zone listings for stable stratification.

Detailed answer:

Paris has several distance zones with different price distributions. Stratifying by distance zone ensures the training and test sets both represent the Paris geography.

Athens has only 53 far-zone listings in the notebook's split logic. Stratifying would place too few far-zone rows in the holdout set. A random split is safer because the Athens dataset is smaller and the far zone is too tiny to split reliably.

### Q16. Why use Optuna hyperparameter tuning?

Short answer:

Optuna searches for stronger model settings more efficiently than manual trial and error.

Detailed answer:

Models like XGBoost (Extreme Gradient Boosting) have settings such as tree depth, learning rate, number of trees, and regularisation strength. These settings can affect overfitting and accuracy. Optuna uses a Tree-structured Parzen Estimator search strategy to learn which settings look promising.

We used 100 trials to make the search systematic while keeping it feasible for the project timeline.

### Q17. Why use SHAP (Shapley Additive Explanations)?

Short answer:

Because we need explainability, not just predictions.

Detailed answer:

A pricing prediction by itself is not enough for a KPMG-style advisory tool. The user needs to understand why the model recommended a price. SHAP (Shapley Additive Explanations) breaks a prediction into feature contributions, showing which variables pushed the price up or down.

This supports:

- Trust.
- Auditability.
- Business explanation.
- Personalised recommendations.

### Q18. Why use a 15 euro underpricing threshold?

Short answer:

It is large enough to represent a meaningful price gap while still capturing enough listings for action.

Detailed answer:

The threshold marks a listing as underpriced when the predicted fair price is more than 15 euro above the actual price. The business logic is that a 15 euro gap is meaningful relative to Athens nightly prices.

Important caveat:

The model's mean absolute error is around 29 euro in the current summary. That means small gaps should be treated as indicative, not certain. Gaps above 25 euro or 40 euro are more defensible as high-confidence underpricing. If the mentor challenges the 15 euro threshold, we should say it is a discovery threshold, not an automatic pricing command.

Recommended answer:

> The 15 euro threshold is useful for identifying candidates, but ARIA should surface uncertainty. For final recommendations, we can rank listings by gap size and treat larger gaps as higher confidence.

## 7. Questions About the LightGBM Host Risk Model

### Q19. Why did we choose LightGBM (Light Gradient Boosting Machine) for risk modelling?

Short answer:

LightGBM (Light Gradient Boosting Machine) is efficient for binary classification and produces useful risk probabilities.

Detailed answer:

The risk problem is different from the pricing problem. We are not predicting a euro value. We are predicting whether a listing looks at risk or not. LightGBM (Light Gradient Boosting Machine) works well for classification, handles structured tabular data efficiently, and supports class weighting through `is_unbalance=True`.

The class split is moderately imbalanced: 56.8 percent at-risk and 43.2 percent not-at-risk. LightGBM (Light Gradient Boosting Machine) can handle this without creating synthetic data.

### Q20. Why only Athens for the risk model?

Short answer:

Athens has the most complete current risk signals.

Detailed answer:

The risk label depends on current availability, review momentum, review growth, and calendar-derived behaviour. Athens has current Inside Airbnb data with these signals. Maven Paris has no current calendar file, and Paris has price reliability limitations. Therefore, Athens is the cleanest city for the first honest risk classifier.

### Q21. What is the `at_risk_host` label and why was it created?

Short answer:

It is a transparent proxy label for listings or hosts showing signs of weakness.

Detailed answer:

Public Airbnb data does not tell us directly whether a host is about to churn or fail. Therefore, the project created a proxy label using observable warning signs.

The label was based on six dimensions:

| Dimension | Plain-language meaning |
|---|---|
| `review_velocity_l30d` below neighbourhood median | The listing is receiving fewer recent reviews/bookings than nearby peers. |
| `availability_365 > 200` | The listing is available for many days, which can mean it is not being booked enough. |
| `review_growth_24_25 < 0` | Booking/review momentum is declining year over year. |
| `review_scores_rating_norm < 8.0` | Guest satisfaction is below the quality threshold. |
| `host_tenure_days < 365` | The host is new and may have limited operating experience. |
| `is_superhost_int = 0` | The host does not have the Airbnb superhost quality badge. |

A listing flagged on three or more dimensions is labelled at risk.

### Q22. Why is the `at_risk_host` label intentionally broad?

Short answer:

It is meant to catch early warning signals, not only confirmed failures.

Detailed answer:

The goal is to identify listings that may need intervention, not only listings that have already failed. A broad label gives the model enough positive examples to learn patterns. The final output is not just yes/no; it is a probability score from 0 to 1. Users can choose stricter thresholds depending on how conservative they want to be.

### Q23. Why were these LightGBM (Light Gradient Boosting Machine) features included?

The final LightGBM (Light Gradient Boosting Machine) model uses 11 features.

| Column | Why it was included |
|---|---|
| `review_velocity_l30d` | Recent review velocity is the strongest booking momentum signal. Low recent activity suggests demand weakness. |
| `review_score_composite` | Overall guest quality affects future demand and host stability. |
| `review_growth_24_25` | Year-over-year review growth shows whether momentum is improving or declining. |
| `host_multi_listing` | Professional multi-listing hosts may behave differently from casual hosts. |
| `amenity_count` | Low amenity depth can reduce listing attractiveness and demand. |
| `host_tenure_days` | Host experience can affect operational quality and resilience. |
| `is_superhost_int` | Superhost status is a platform-recognised quality signal. |
| `dist_km` | Peripheral listings may face weaker tourist demand in Athens. |
| `person_capacity` | Smaller or less flexible capacity can limit market appeal. |
| `reviews_per_month` | General review volume supports the recent demand signal. |
| `room_type_encoded` | Room type affects demand and risk profile. |

### Q24. Why were some obvious columns excluded from the risk model?

Short answer:

Because they would leak the answer.

Detailed answer:

Some columns looked predictive because they were directly used to build the target label. If we included them, the model would appear extremely accurate but would not be genuinely learning.

Excluded columns:

| Column | Why it was excluded |
|---|---|
| `availability_pressure` | It is a direct proxy for one of the risk-label dimensions. |
| `availability_365` | It is an exact label condition in the risk definition. |
| `review_scores_rating_norm` | It is an exact label condition in the risk definition. |
| `estimated_occupancy_l365d` | It is derived from demand and could indirectly leak target logic. |
| `estimated_revenue_l365d` | It is derived from price and occupancy, so it can leak downstream outcome information. |
| `price_eur` and `log_price` | Price is not the risk target and can introduce unwanted pricing leakage. |
| `at_risk_host` | This is the target itself. |

### Q25. What is data leakage and what happened in this project?

Short answer:

Data leakage happens when the model accidentally sees information that gives away the answer.

Detailed answer:

An earlier risk model run produced an unrealistically high Area Under the Receiver Operating Characteristic Curve score of 0.9995. That was a warning sign. The team inspected SHAP (Shapley Additive Explanations) and found that `availability_pressure` dominated the model because it was directly connected to the target label.

The team removed the leaking columns. The corrected model produced an honest Area Under the Receiver Operating Characteristic Curve score of 0.8288.

Mentor-ready phrasing:

> This is actually a strength of the project. We did not accept a suspiciously perfect model. We investigated it, found leakage, corrected it, and reported the honest metric.

### Q26. Why use Area Under the Receiver Operating Characteristic Curve instead of accuracy?

Short answer:

Accuracy is misleading when one class is more common than the other.

Detailed answer:

In the Athens risk model, 56.8 percent of listings are labelled at risk. A naive model could predict "at risk" for every listing and get 56.8 percent accuracy without learning anything. Area Under the Receiver Operating Characteristic Curve measures whether the model ranks risky listings above safer listings across thresholds.

Because ARIA (Agentic Real-estate Intelligence Advisor) is a prioritisation tool, ranking quality matters more than raw accuracy.

### Q27. Why use a high-risk threshold of 0.70?

Short answer:

It separates priority cases from general monitoring cases.

Detailed answer:

The model outputs a probability from 0 to 1. The project uses:

- 0.00 to 0.40: low risk.
- 0.40 to 0.70: moderate risk.
- 0.70 to 1.00: high risk.

The 0.70 high-risk threshold creates a stricter priority group for intervention. The continuous probability remains available, so the threshold can be changed later depending on business appetite for false positives versus false negatives.

## 8. Questions About the Combined Business Output

### Q28. Why is the 865-listing overlap so important?

Short answer:

It combines pricing opportunity and risk urgency.

Detailed answer:

A listing that is only underpriced may be an opportunity. A listing that is only high-risk may need monitoring. A listing that is both underpriced and high-risk is more urgent because it may be losing revenue while also showing signs of declining performance.

This makes the 865-listing overlap the best current "hero output" for the project.

### Q29. What action would ARIA recommend for an underpriced and high-risk listing?

Likely actions:

- Recalculate fair price using the pricing model.
- Check whether the underpricing gap is large enough to act confidently.
- Review SHAP (Shapley Additive Explanations) drivers to understand why the model recommends a higher price.
- Check risk drivers, especially review velocity and review quality.
- Recommend pricing, quality, and booking-momentum interventions.

Example:

> If a listing is underpriced but has zero recent review velocity, ARIA should not simply recommend a large price increase. It may recommend a controlled price adjustment, quality improvements, and short-term demand recovery first.

## 9. Questions About Explainability

### Q30. Why is explainability central to this project?

Short answer:

Because KPMG-style advisory work needs defensible reasoning, not black-box outputs.

Detailed answer:

The project is not only trying to predict. It is trying to advise. A host, investor, or mentor needs to know why the system made a recommendation. SHAP (Shapley Additive Explanations) gives feature-level reasoning.

For example:

- If the pricing model recommends a higher price, SHAP (Shapley Additive Explanations) can show whether the reason is neighbourhood, capacity, reviews, or location.
- If the risk model flags a listing, SHAP (Shapley Additive Explanations) can show whether the reason is low recent demand, poor review score, distance, or host profile.

### Q31. Why not just show feature importance?

Feature importance shows which columns matter overall. SHAP (Shapley Additive Explanations) can explain both global patterns and individual predictions. For an advisory tool, individual explanation matters more because users ask about a specific listing or neighbourhood.

## 10. Questions About Planned Future Phases

### Q32. Why do we need Prophet forecasting?

Short answer:

Pricing and risk explain the current state. Forecasting adds a future demand view.

Detailed answer:

Prophet is intended to estimate future occupancy or demand patterns. This matters because a pricing recommendation should change depending on expected demand. If future occupancy is expected to rise, ARIA (Agentic Real-estate Intelligence Advisor) may recommend a higher price. If demand is expected to fall, it may recommend a more cautious strategy.

Recommended mentor question:

> Should forecasting be at city level, distance-zone level, or neighbourhood level?

### Q33. Why do we need retrieval-augmented generation (RAG) compliance?

Short answer:

Because pricing and risk are not enough if a listing may be non-compliant.

Detailed answer:

Retrieval-augmented generation connects a user question or listing to relevant regulatory text. For this project, the obvious target is the 137 unlicensed Athens listings. A compliance agent could retrieve the relevant regulation and explain the risk in plain language.

This matters for KPMG because it connects artificial intelligence (AI) with governance, regulation, and advisory decision-making.

### Q34. Why do we need LangGraph orchestration?

Short answer:

Because a user question may require several specialist agents.

Detailed answer:

A question such as "Should I invest in this Athens neighbourhood?" may need:

- Pricing model output.
- Risk model output.
- Forecasting output.
- Compliance retrieval.
- Natural-language synthesis.

LangGraph provides a structure for routing a question across multiple specialist nodes and combining the answers.

## 11. Questions About the User Interface Demo

### Q35. Why build a Vercel web demo before all backend phases are complete?

Short answer:

Because stakeholders need to see the product vision, not only notebooks.

Detailed answer:

The web demo makes the project easier to understand for nontechnical mentors and evaluators. It shows how the final system could feel: a user asks a question, ARIA routes it to an agent, shows reasoning, and returns a business recommendation.

The current demo is intentionally reliable for presentation. It uses scripted, project-grounded answers unless live Gemini mode is enabled.

### Q36. Is the demo fully connected to the models?

Answer:

Not yet. The demo is a polished front-end and stakeholder experience. The model files and output files exist separately in the repository. The next engineering step is to connect one real backend workflow into the demo, preferably Host Revenue Intelligence using the Athens underpricing and risk files.

## 12. Potential Mentor Challenges and Best Answers

### Challenge 1. "Your target label for risk is engineered. Is that valid?"

Best answer:

Yes, with limitations. Public Airbnb data does not include a true host churn label, so we created a transparent proxy from observable warning signs. The label is not presented as absolute truth. It is a prioritisation signal. We also use probability scores, not only a binary label, so future users can choose stricter thresholds.

### Challenge 2. "Why should I trust a model trained on imperfect public data?"

Best answer:

We do not pretend the data is perfect. We document limitations directly, use routing flags to protect model training, exclude estimated Paris prices from pricing training, and disclose where Athens is stronger than Paris. The project is strongest as a proof of concept for explainable advisory workflows.

### Challenge 3. "Why did you not use one model for everything?"

Best answer:

Each task has a different target. Pricing predicts a euro value. Risk predicts a probability. Compliance retrieves regulation. Forecasting predicts future demand. A single model would blur these tasks and be harder to explain. The agentic architecture lets each specialist model do the job it is suited for.

### Challenge 4. "Why not use only ChatGPT or Gemini?"

Best answer:

A large language model can explain and synthesise, but it should not invent pricing or risk scores. The numerical outputs come from structured models trained on project data. The language model should sit on top as an explanation layer, not replace the underlying analytics.

### Challenge 5. "Is 0.8288 Area Under the Receiver Operating Characteristic Curve good enough?"

Best answer:

Yes for this type of early-warning risk task using public data and an engineered proxy label. It is much better than a naive baseline, stable across validation folds, and honest after leakage correction. More importantly, it is used for ranking and prioritisation, not for automatic irreversible decisions.

### Challenge 6. "Why is the XGBoost Paris score lower than Athens?"

Best answer:

Paris pricing is harder because the observed Paris prices come from Maven 2021, while current Paris demand context comes from Inside Airbnb 2025 with estimated prices. Athens has current observed prices and richer current behavioural signals, so Athens is the stronger actionable model.

### Challenge 7. "Are the 2,945 underpriced listings definitely underpriced?"

Best answer:

They are model-identified candidates, not guaranteed truths. The 15 euro threshold is useful for discovery. Larger gaps, such as above 25 euro or 40 euro, should be treated as higher confidence. ARIA should present uncertainty and explanations with every recommendation.

### Challenge 8. "Could `neighbourhood_median_price` leak information?"

Best answer:

It is a legitimate market benchmark but must be handled carefully. It is not the listing's own price and is interpretable as local market context. For production, we would compute it from historical or training-only data to avoid any possible holdout contamination. For the capstone, it is a transparent and useful neighbourhood benchmark.

### Challenge 9. "Why is the web demo scripted?"

Best answer:

The scripted mode ensures the mentor and evaluators see a stable, accurate, project-grounded experience. Live model integration is the next engineering phase. The demo is not pretending to be a production backend; it shows the intended product workflow and design.

## 13. Implementation Truths to Know Before the Meeting

These are small inconsistencies or caveats the team should know before showing files live.

### Point 1. Current underpricing count

The current exported file `data/outputs/athens_underpricing_v1.csv` contains 2,945 underpriced listings. Some older notebook markdown text mentions 2,350 flagged listings and 4.4 million euro. Use the current exported file and summary number: 2,945 listings and about 4.8 million euro.

Suggested answer if asked:

> The notebook narrative has one stale markdown line from an earlier run. The current exported file and README use the latest count: 2,945 underpriced Athens listings.

### Point 2. XGBoost neighbourhood feature

The current SHAP (Shapley Additive Explanations) output includes `neighbourhood_median_price`, not `neighbourhood_target_encoded`.

Suggested answer:

> The final implemented neighbourhood feature is neighbourhood median price. It is easier to explain and directly supports the underpricing benchmark logic.

### Point 3. LightGBM feature count

Some notebook explanation text discusses broader feature categories, but the final implemented LightGBM (Light Gradient Boosting Machine) feature list has 11 columns after leakage exclusions.

Suggested answer:

> The broader feature categories explain the design space. The final model uses 11 columns after removing leakage-prone variables.

### Point 4. Risk output file contents

The risk output file currently contains listing identifier, neighbourhood, risk probability, high-risk flag, and risk band. Some notebook text says it includes the top SHAP (Shapley Additive Explanations) feature per listing, but the current saved comma-separated values file does not include that column.

Suggested answer:

> The explanation visuals and SHAP analysis exist in the notebook, but the compact risk score export currently saves only the fields needed for joining and dashboarding. Adding per-listing top SHAP driver is a good next improvement.

## 14. Final Recommended Meeting Position

The safest final position is:

> We have completed the analytical foundation and the first two core machine learning models. The strongest validated business story is Athens host revenue intelligence: underpricing plus host risk. The user interface demonstrates how this can become an agentic product. The next step is to connect forecasting, compliance retrieval, and orchestration into one real backend flow.

This position is honest, strong, and defensible.

