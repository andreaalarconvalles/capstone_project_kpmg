

\#### Neighbourhood market context



| Column | Why it was included |

|---|---|

| `neighbourhood\_median\_price` | Gives the model a local market benchmark. A listing in a high-price neighbourhood should not be compared directly with one in a low-price neighbourhood. |



Important implementation note:



The current exported SHAP (Shapley Additive Explanations) file confirms `neighbourhood\_median\_price` as the final neighbourhood feature. Some older notebook text mentions `neighbourhood\_target\_encoded`, but the implemented final feature matrix uses `neighbourhood\_median\_price`. If asked, the clean answer is that neighbourhood median price is more interpretable, safer to explain, and directly aligned with the underpricing benchmark logic.



\### Q11. Why did we include interaction columns?



Short answer:



Some features only make sense in combination.



Detailed answer:



For example, capacity alone is not enough. A high-capacity listing in the centre may command a very different premium than a high-capacity listing far from the centre. Similarly, room type and capacity together say more than either column alone. Interactions help the model capture real market patterns.



\### Q12. Why use `neighbourhood\_median\_price`?



Short answer:



Because real-estate pricing is local.



Detailed answer:



A listing's fair price depends strongly on its neighbourhood. `neighbourhood\_median\_price` gives the model a market benchmark. This is also easy for nontechnical audiences to understand: a listing is evaluated against similar listings in its area, not against the whole city.



Possible mentor challenge:



> Is that leakage because it uses price?



Answer:



It is a market context feature, but it must be handled carefully. In the current project it is used as a neighbourhood-level benchmark from the modelling dataset. It is less risky than using the individual listing's own price directly. The model never uses `price\_eur` or `log\_price` as input features. For a production version, we would compute neighbourhood medians only from training data or from a historical benchmark table to remove any possible holdout contamination.



\### Q13. Which columns were excluded from the XGBoost (Extreme Gradient Boosting) pricing model and why?



Excluded columns included:



| Column | Why it was excluded |

|---|---|

| `price\_eur` | This is the raw target source. Including it would directly reveal the answer. |

| `log\_price` | This is the transformed target. Including it would be direct leakage. |

| `price\_eur\_estimated` | This marks estimated prices and could teach the model source artefacts rather than market behaviour. |

| `xgb\_price\_training\_eligible` | This is a routing flag, not a business driver of price. |

| `estimated\_revenue\_l365d` | Revenue is partly derived from price and occupancy, so it can leak target information. |



\## 6. Questions About the XGBoost Training Method



\### Q14. Why use an 80 percent training and 20 percent holdout split?



Short answer:



It keeps enough data for training while preserving an honest final test set.



Detailed answer:



The model trains on 80 percent of the data. The remaining 20 percent is locked away and used only for final evaluation. This prevents the team from repeatedly tuning the model on the same examples used to judge performance.



\### Q15. Why was Paris stratified by distance zone, while Athens used a random split?



Short answer:



Paris needed distance-zone balance. Athens had too few far-zone listings for stable stratification.



Detailed answer:



Paris has several distance zones with different price distributions. Stratifying by distance zone ensures the training and test sets both represent the Paris geography.



Athens has only 53 far-zone listings in the notebook's split logic. Stratifying would place too few far-zone rows in the holdout set. A random split is safer because the Athens dataset is smaller and the far zone is too tiny to split reliably.



\### Q16. Why use Optuna hyperparameter tuning?



Short answer:



Optuna searches for stronger model settings more efficiently than manual trial and error.



Detailed answer:



Models like XGBoost (Extreme Gradient Boosting) have settings such as tree depth, learning rate, number of trees, and regularisation strength. These settings can affect overfitting and accuracy. Optuna uses a Tree-structured Parzen Estimator search strategy to learn which settings look promising.



We used 100 trials to make the search systematic while keeping it feasible for the project timeline.



\### Q17. Why use SHAP (Shapley Additive Explanations)?



Short answer:



Because we need explainability, not just predictions.



Detailed answer:



A pricing prediction by itself is not enough for a KPMG-style advisory tool. The user needs to understand why the model recommended a price. SHAP (Shapley Additive Explanations) breaks a prediction into feature contributions, showing which variables pushed the price up or down.



This supports:



\- Trust.

\- Auditability.

\- Business explanation.

\- Personalised recommendations.



\### Q18. Why use a 15 euro underpricing threshold?



Short answer:



It is large enough to represent a meaningful price gap while still capturing enough listings for action.



Detailed answer:



The threshold marks a listing as underpriced when the predicted fair price is more than 15 euro above the actual price. The business logic is that a 15 euro gap is meaningful relative to Athens nightly prices.



Important caveat:



The model's mean absolute error is around 29 euro in the current summary. That means small gaps should be treated as indicative, not certain. Gaps above 25 euro or 40 euro are more defensible as high-confidence underpricing. If the mentor challenges the 15 euro threshold, we should say it is a discovery threshold, not an automatic pricing command.



Recommended answer:



> The 15 euro threshold is useful for identifying candidates, but ARIA should surface uncertainty. For final recommendations, we can rank listings by gap size and treat larger gaps as higher confidence.



\## 7. Questions About the LightGBM Host Risk Model



\### Q19. Why did we choose LightGBM (Light Gradient Boosting Machine) for risk modelling?



Short answer:



LightGBM (Light Gradient Boosting Machine) is efficient for binary classification and produces useful risk probabilities.



Detailed answer:



The risk problem is different from the pricing problem. We are not predicting a euro value. We are predicting whether a listing looks at risk or not. LightGBM (Light Gradient Boosting Machine) works well for classification, handles structured tabular data efficiently, and supports class weighting through `is\_unbalance=True`.



The class split is moderately imbalanced: 56.8 percent at-risk and 43.2 percent not-at-risk. LightGBM (Light Gradient Boosting Machine) can handle this without creating synthetic data.



\### Q20. Why only Athens for the risk model?



Short answer:



Athens has the most complete current risk signals.



Detailed answer:



The risk label depends on current availability, review momentum, review growth, and calendar-derived behaviour. Athens has current Inside Airbnb data with these signals. Maven Paris has no current calendar file, and Paris has price reliability limitations. Therefore, Athens is the cleanest city for the first honest risk classifier.



\### Q21. What is the `at\_risk\_host` label and why was it created?



Short answer:



It is a transparent proxy label for listings or hosts showing signs of weakness.



Detailed answer:



Public Airbnb data does not tell us directly whether a host is about to churn or fail. Therefore, the project created a proxy label using observable warning signs.



The label was based on six dimensions:



| Dimension | Plain-language meaning |

|---|---|

| `review\_velocity\_l30d` below neighbourhood median | The listing is receiving fewer recent reviews/bookings than nearby peers. |

| `availability\_365 > 200` | The listing is available for many days, which can mean it is not being booked enough. |

| `review\_growth\_24\_25 < 0` | Booking/review momentum is declining year over year. |

| `review\_scores\_rating\_norm < 8.0` | Guest satisfaction is below the quality threshold. |

| `host\_tenure\_days < 365` | The host is new and may have limited operating experience. |

| `is\_superhost\_int = 0` | The host does not have the Airbnb superhost quality badge. |



A listing flagged on three or more dimensions is labelled at risk.



\### Q22. Why is the `at\_risk\_host` label intentionally broad?



Short answer:



It is meant to catch early warning signals, not only confirmed failures.



Detailed answer:



The goal is to identify listings that may need intervention, not only listings that have already failed. A broad label gives the model enough positive examples to learn patterns. The final output is not just yes/no; it is a probability score from 0 to 1. Users can choose stricter thresholds depending on how conservative they want to be.



\### Q23. Why were these LightGBM (Light Gradient Boosting Machine) features included?



The final LightGBM (Light Gradient Boosting Machine) model uses 11 features.



| Column | Why it was included |

|---|---|

| `review\_velocity\_l30d` | Recent review velocity is the strongest booking momentum signal. Low recent activity suggests demand weakness. |

| `review\_score\_composite` | Overall guest quality affects future demand and host stability. |

| `review\_growth\_24\_25` | Year-over-year review growth shows whether momentum is improving or declining. |

| `host\_multi\_listing` | Professional multi-listing hosts may behave differently from casual hosts. |

| `amenity\_count` | Low amenity depth can reduce listing attractiveness and demand. |

| `host\_tenure\_days` | Host experience can affect operational quality and resilience. |

| `is\_superhost\_int` | Superhost status is a platform-recognised quality signal. |

| `dist\_km` | Peripheral listings may face weaker tourist demand in Athens. |

| `person\_capacity` | Smaller or less flexible capacity can limit market appeal. |

| `reviews\_per\_month` | General review volume supports the recent demand signal. |

| `room\_type\_encoded` | Room type affects demand and risk profile. |



\### Q24. Why were some obvious columns excluded from the risk model?



Short answer:

